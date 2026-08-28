import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, it } from 'vitest';
import { HanselStack } from './hansel-stack.js';

function template(stage: string): Template {
  const app = new cdk.App();
  if (stage === 'production') {
    app.node.setContext('domainName', 'hansel.example.com');
    app.node.setContext(
      'certificateArn',
      'arn:aws:acm:us-east-1:111111111111:certificate/example',
    );
  }
  return Template.fromStack(new HanselStack(app, `Test-${stage}`, { stage }));
}

describe('HanselStack [REQ-004]', () => {
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
            { Name: 'DISCOVERY_ENABLED', Value: 'false' },
          ]),
        }),
      ]),
    });
    output.hasResourceProperties('AWS::ElasticLoadBalancingV2::TargetGroup', {
      HealthCheckPath: '/api/health',
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
    output.hasResourceProperties('AWS::Logs::MetricFilter', {
      MetricTransformations: Match.arrayWith([
        Match.objectLike({ MetricNamespace: 'Hansel/Onboarding' }),
      ]),
    });
    output.resourceCountIs('AWS::CloudWatch::Alarm', 5);
    output.hasResourceProperties('AWS::Logs::MetricFilter', {
      MetricTransformations: Match.arrayWith([
        Match.objectLike({
          MetricName: 'OrganizationProfileUnexpectedFailures',
        }),
      ]),
    });
    output.hasResourceProperties('AWS::Logs::MetricFilter', {
      MetricTransformations: Match.arrayWith([
        Match.objectLike({ MetricName: 'DiscoveryUnexpectedFailures' }),
      ]),
    });
    output.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({
          ViewerProtocolPolicy: 'redirect-to-https',
        }),
        CacheBehaviors: Match.arrayWith([
          Match.objectLike({ PathPattern: 'api/*' }),
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
});
