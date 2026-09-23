import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { HanselStack } from './hansel-stack.js';

function template(
  stage: string,
  context: Record<string, string> = {},
): Template {
  const app = new cdk.App();
  for (const [key, value] of Object.entries(context))
    app.node.setContext(key, value);
  if (stage === 'production') {
    if (!context.domainName)
      app.node.setContext('domainName', 'hansel.example.com');
    app.node.setContext(
      'certificateArn',
      'arn:aws:acm:us-east-1:111111111111:certificate/example',
    );
  }
  return Template.fromStack(new HanselStack(app, `Test-${stage}`, { stage }));
}

describe('HanselStack [REQ-004; onboarding-welcome-email REQ-014, REQ-016; sites-add-new REQ-023]', () => {
  it.each(['development', 'staging', 'production'])(
    '%s uses NAT without paid endpoints [remove-interface-endpoints REQ-001, REQ-002, REQ-003]',
    (stage) => {
      const output = template(stage);
      output.resourceCountIs('AWS::EC2::VPCEndpoint', 1);
      output.hasResourceProperties('AWS::EC2::VPCEndpoint', {
        VpcEndpointType: 'Gateway',
        ServiceName: {
          'Fn::Join': ['', ['com.amazonaws.', { Ref: 'AWS::Region' }, '.s3']],
        },
      });
      output.resourceCountIs(
        'AWS::EC2::NatGateway',
        stage === 'production' ? 2 : 1,
      );
      const [service] = Object.values(
        output.findResources('AWS::ECS::Service'),
      );
      if (!service) throw new Error('Missing API service');
      const network =
        service.Properties.NetworkConfiguration.AwsvpcConfiguration;
      expect(network.AssignPublicIp).toBe('DISABLED');
      const associations = Object.values(
        output.findResources('AWS::EC2::SubnetRouteTableAssociation'),
      );
      const routes = Object.values(output.findResources('AWS::EC2::Route'));
      const natGateways = output.findResources('AWS::EC2::NatGateway');
      for (const subnet of network.Subnets) {
        const association = associations.find(
          (item) => item.Properties.SubnetId.Ref === subnet.Ref,
        );
        expect(association).toBeDefined();
        const route = routes.find(
          (item) =>
            item.Properties.RouteTableId.Ref ===
              association?.Properties.RouteTableId.Ref &&
            item.Properties.DestinationCidrBlock === '0.0.0.0/0',
        );
        expect(route).toBeDefined();
        expect(Object.keys(natGateways)).toContain(
          route?.Properties.NatGatewayId.Ref,
        );
      }
      const [databaseSubnets] = Object.values(
        output.findResources('AWS::RDS::DBSubnetGroup'),
      );
      if (!databaseSubnets) throw new Error('Missing database subnet group');
      for (const subnet of databaseSubnets.Properties.SubnetIds) {
        const association = associations.find(
          (item) => item.Properties.SubnetId.Ref === subnet.Ref,
        );
        expect(association).toBeDefined();
        expect(
          routes.filter(
            (item) =>
              item.Properties.RouteTableId.Ref ===
                association?.Properties.RouteTableId.Ref &&
              item.Properties.DestinationCidrBlock === '0.0.0.0/0',
          ),
        ).toHaveLength(0);
      }
    },
  );

  it('uses private compute and an encrypted, protected production database', () => {
    const output = template('production');
    output.hasResourceProperties('AWS::RDS::DBCluster', {
      DeletionProtection: true,
      StorageEncrypted: true,
      BackupRetentionPeriod: 35,
      Engine: 'aurora-postgresql',
    });
    output.hasResourceProperties('AWS::ECS::Service', { DesiredCount: 2 });
    output.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Environment: Match.arrayWith([
            { Name: 'DB_NAME', Value: 'hansel' },
            { Name: 'EMAIL_DELIVERY_MODE', Value: 'resend' },
            { Name: 'DISCOVERY_ENABLED', Value: 'false' },
            { Name: 'DASHBOARD_ENABLED', Value: 'false' },
            { Name: 'ORGANIZATION_TRAY_SETTINGS_ENABLED', Value: 'false' },
            { Name: 'SITES_ENABLED', Value: 'false' },
            { Name: 'LOGIN_ENABLED', Value: 'false' },
            { Name: 'PASSWORD_RECOVERY_ENABLED', Value: 'false' },
            { Name: 'EXTERNAL_AUTH_ENABLED', Value: 'false' },
            { Name: 'WELCOME_EMAIL_ENABLED', Value: 'false' },
          ]),
          Secrets: Match.arrayWith([
            Match.objectLike({ Name: 'APPLICATION_SESSION_DIGEST_KEY' }),
            Match.objectLike({ Name: 'PASSWORD_PEPPER' }),
            Match.objectLike({ Name: 'VERIFICATION_DIGEST_KEY' }),
            Match.objectLike({ Name: 'EXTERNAL_AUTH_TRANSACTION_KEY' }),
            Match.objectLike({ Name: 'RESEND_API_KEY' }),
            Match.objectLike({ Name: 'RESEND_FROM_EMAIL' }),
          ]),
        }),
      ]),
    });
    output.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      HealthCheckPath: '/api/health',
    });
  });

  it('enables password recovery only through the explicit login-coupled context [password-recovery REQ-021]', () => {
    const disabled = template('test', { passwordRecoveryEnabled: 'true' });
    disabled.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Environment: Match.arrayWith([
            { Name: 'PASSWORD_RECOVERY_ENABLED', Value: 'false' },
          ]),
        }),
      ]),
    });
    const enabled = template('test', {
      loginEnabled: 'true',
      passwordRecoveryEnabled: 'true',
    });
    enabled.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Environment: Match.arrayWith([
            { Name: 'PASSWORD_RECOVERY_ENABLED', Value: 'true' },
          ]),
        }),
      ]),
    });
  });

  it('protects web content and public traffic', () => {
    const output = template('test');
    output.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: Match.objectLike({
        ServerSideEncryptionConfiguration: Match.anyValue(),
      }),
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
    });
    output.resourceCountIs('AWS::WAFv2::WebACL', 1);
    expect(
      JSON.stringify(output.findResources('AWS::WAFv2::WebACL')),
    ).toContain('authentication-rate-limit');
    expect(
      JSON.stringify(output.findResources('AWS::WAFv2::WebACL')),
    ).toContain('AWSManagedRulesAmazonIpReputationList');
    output.hasResourceProperties('AWS::Logs::MetricFilter', {
      MetricTransformations: Match.arrayWith([
        Match.objectLike({ MetricNamespace: 'Hansel/Onboarding' }),
      ]),
    });
    for (const metricName of [
      'WelcomeEmailCreated',
      'WelcomeEmailClaimed',
      'WelcomeEmailDelivered',
      'WelcomeEmailTransientFailures',
      'WelcomeEmailLeaseRecoveries',
      'WelcomeEmailRetryExhausted',
      'WelcomeEmailAttemptCount',
    ])
      output.hasResourceProperties('AWS::Logs::MetricFilter', {
        MetricTransformations: Match.arrayWith([
          Match.objectLike({ MetricName: metricName }),
        ]),
      });
    output.resourceCountIs('AWS::CloudWatch::Alarm', 18);
    for (const metricName of [
      'PasswordRecoveryRequestsSuppressed',
      'PasswordRecoveryRequestsAccepted',
      'PasswordRecoveryEmailsAttempted',
      'PasswordRecoveryEmailsSent',
      'PasswordRecoveryEmailFailures',
      'PasswordResetsSucceeded',
      'PasswordResetsRejected',
      'PasswordRecoveryUnexpectedFailures',
      'PasswordResetUnexpectedFailures',
      'PasswordResetUnavailable',
      'PasswordRecoverySessionsRevoked',
      'PasswordResetNotificationsCreated',
      'PasswordResetNotificationTerminalFailures',
      'PasswordResetNotificationOldestPendingAgeSeconds',
    ])
      output.hasResourceProperties('AWS::Logs::MetricFilter', {
        MetricTransformations: Match.arrayWith([
          Match.objectLike({ MetricName: metricName }),
        ]),
      });
    output.hasResourceProperties('AWS::Logs::MetricFilter', {
      MetricTransformations: Match.arrayWith([
        Match.objectLike({
          MetricName: 'OrganizationProfileUnexpectedFailures',
        }),
      ]),
    });
    output.hasResourceProperties('AWS::Logs::MetricFilter', {
      MetricTransformations: Match.arrayWith([
        Match.objectLike({ MetricName: 'WelcomeEmailTerminalFailures' }),
      ]),
    });
    output.hasResourceProperties('AWS::Logs::MetricFilter', {
      MetricTransformations: Match.arrayWith([
        Match.objectLike({
          MetricName: 'WelcomeEmailOldestPendingAgeSeconds',
          MetricValue: '$.ageSeconds',
        }),
      ]),
    });
    expect(
      JSON.stringify(output.findResources('AWS::CloudWatch::Dashboard')),
    ).toContain('Welcome email delivery');
    expect(
      JSON.stringify(output.findResources('AWS::CloudWatch::Dashboard')),
    ).toContain('Authentication safety');
    const distribution = JSON.stringify(
      output.findResources('AWS::CloudFront::Distribution'),
    );
    expect(distribution).toContain('forgot-password');
    expect(distribution).toContain('reset-password');
    output.hasResourceProperties('AWS::Logs::MetricFilter', {
      MetricTransformations: Match.arrayWith([
        Match.objectLike({ MetricName: 'DiscoveryUnexpectedFailures' }),
      ]),
    });
    output.hasResourceProperties('AWS::Logs::MetricFilter', {
      MetricTransformations: Match.arrayWith([
        Match.objectLike({ MetricName: 'DashboardUnexpectedFailures' }),
      ]),
    });
    output.hasResourceProperties('AWS::Logs::MetricFilter', {
      MetricTransformations: Match.arrayWith([
        Match.objectLike({ MetricName: 'DashboardRefreshFailures' }),
      ]),
    });
    output.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: 'redirect-to-https',
        }),
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: 'api/*' }),
          Match.objectLike({ PathPattern: 'login' }),
          Match.objectLike({ PathPattern: 'auth/*' }),
          Match.objectLike({ PathPattern: 'onboarding/about-you' }),
          Match.objectLike({ PathPattern: 'onboarding/plan-selection' }),
          Match.objectLike({
            PathPattern: 'onboarding/organization-profile',
          }),
          Match.objectLike({ PathPattern: 'onboarding/discovery' }),
        ]),
      }),
    });
  });

  it('provisions private staged Allocation Plan storage [site-allocation-plans-add REQ-010, REQ-011, REQ-018, REQ-024]', () => {
    const output = template('production', {
      allocationPlansEnabled: 'true',
      domainName: 'hansel.example.com',
    });
    output.resourceCountIs('AWS::S3::Bucket', 4);
    output.hasResourceProperties('AWS::S3::Bucket', {
      BucketEncryption: Match.anyValue(),
      OwnershipControls: {
        Rules: [{ ObjectOwnership: 'BucketOwnerEnforced' }],
      },
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      CorsConfiguration: {
        CorsRules: Match.arrayWith([
          Match.objectLike({
            AllowedMethods: ['PUT'],
            AllowedOrigins: ['https://hansel.example.com'],
          }),
        ]),
      },
      VersioningConfiguration: { Status: 'Enabled' },
    });
    output.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Environment: Match.arrayWith([
            { Name: 'ALLOCATION_PLANS_ENABLED', Value: 'true' },
            Match.objectLike({ Name: 'ALLOCATION_PLANS_BUCKET_NAME' }),
          ]),
        }),
      ]),
    });
    const policies = JSON.stringify(output.findResources('AWS::IAM::Policy'));
    expect(policies).toContain('quarantine/*');
    // allocation-plan-comments REQ-007,010: private published attachment access.
    expect(policies).toContain('plan-comments/*');
    expect(policies).toContain('plans/*');
  });

  it('injects stage-scoped provider configuration only when both rollout flags are enabled', () => {
    const output = template('test', {
      loginEnabled: 'true',
      externalAuthEnabled: 'true',
      appleCallbackUrl: 'https://apple.dev.example/auth/callback/apple',
    });
    output.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Environment: Match.arrayWith([
            { Name: 'LOGIN_ENABLED', Value: 'true' },
            { Name: 'EXTERNAL_AUTH_ENABLED', Value: 'true' },
            {
              Name: 'APPLE_CALLBACK_URL',
              Value: 'https://apple.dev.example/auth/callback/apple',
            },
          ]),
          Secrets: Match.arrayWith([
            Match.objectLike({ Name: 'GOOGLE_CLIENT_ID' }),
            Match.objectLike({ Name: 'GOOGLE_CLIENT_SECRET' }),
            Match.objectLike({ Name: 'MICROSOFT_CLIENT_ID' }),
            Match.objectLike({ Name: 'MICROSOFT_CLIENT_SECRET' }),
            Match.objectLike({ Name: 'MICROSOFT_TENANT_ID' }),
            Match.objectLike({ Name: 'APPLE_CLIENT_ID' }),
            Match.objectLike({ Name: 'APPLE_TEAM_ID' }),
            Match.objectLike({ Name: 'APPLE_KEY_ID' }),
            Match.objectLike({ Name: 'APPLE_PRIVATE_KEY' }),
          ]),
        }),
      ]),
    });
  });

  it('supports a deliberate staged production enablement with the exact callback origin [sites-add-new REQ-023]', () => {
    const output = template('production', {
      domainName: 'app.hanselapp.io',
      loginEnabled: 'true',
      externalAuthEnabled: 'true',
      sitesEnabled: 'true',
    });
    output.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Environment: Match.arrayWith([
            { Name: 'SITES_ENABLED', Value: 'true' },
            { Name: 'LOGIN_ENABLED', Value: 'true' },
            { Name: 'EXTERNAL_AUTH_ENABLED', Value: 'true' },
            {
              Name: 'APPLE_CALLBACK_URL',
              Value: 'https://app.hanselapp.io/auth/callback/apple',
            },
          ]),
        }),
      ]),
    });
  });

  it('bootstraps migration infrastructure without serving traffic', () => {
    const output = template('test', { migrationBootstrap: 'true' });
    output.hasResourceProperties('AWS::ECS::Service', { DesiredCount: 0 });
  });
});
