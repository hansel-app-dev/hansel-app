import * as path from 'node:path';
import * as cdk from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import type { Construct } from 'constructs';

export interface HanselStackProps extends cdk.StackProps {
  stage: string;
}

export class HanselStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: HanselStackProps) {
    super(scope, id, props);
    const production = props.stage === 'production';
    const welcomeEmailContext = this.node.tryGetContext(
      'welcomeEmailEnabled',
    ) as string | undefined;
    const welcomeEmailEnabled =
      welcomeEmailContext === 'true' ||
      (welcomeEmailContext === undefined && !production);
    const loginEnabled = this.node.tryGetContext('loginEnabled') === 'true';
    const passwordRecoveryEnabled =
      this.node.tryGetContext('passwordRecoveryEnabled') === 'true' &&
      loginEnabled;
    const externalAuthEnabled =
      this.node.tryGetContext('externalAuthEnabled') === 'true' && loginEnabled;
    const configuredAppleCallbackUrl = this.node.tryGetContext(
      'appleCallbackUrl',
    ) as string | undefined;
    const migrationBootstrap =
      this.node.tryGetContext('migrationBootstrap') === 'true';
    const domainName = this.node.tryGetContext('domainName') as
      string | undefined;
    const certificateArn = this.node.tryGetContext('certificateArn') as
      string | undefined;
    if (production && (!domainName || !certificateArn)) {
      throw new Error(
        'Production requires domainName and a us-east-1 certificateArn CDK context',
      );
    }
    if (externalAuthEnabled && !production && !configuredAppleCallbackUrl)
      throw new Error(
        'External auth development requires an appleCallbackUrl HTTPS context',
      );
    const removalPolicy = production
      ? cdk.RemovalPolicy.RETAIN
      : cdk.RemovalPolicy.DESTROY;

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 3,
      natGateways: production ? 2 : 1,
      subnetConfiguration: [
        { name: 'public', subnetType: ec2.SubnetType.PUBLIC },
        { name: 'application', subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        { name: 'database', subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      ],
    });
    vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });
    for (const [name, service] of [
      ['EcrApi', ec2.InterfaceVpcEndpointAwsService.ECR],
      ['EcrDocker', ec2.InterfaceVpcEndpointAwsService.ECR_DOCKER],
      ['CloudWatchLogs', ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS],
      ['SecretsManager', ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER],
    ] as const)
      vpc.addInterfaceEndpoint(`${name}Endpoint`, {
        service,
        privateDnsEnabled: true,
      });

    const databaseSecret = new secretsmanager.Secret(this, 'DatabaseSecret', {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'hansel' }),
        generateStringKey: 'password',
        excludePunctuation: true,
      },
    });
    const applicationSessionDigestSecret = new secretsmanager.Secret(
      this,
      'ApplicationSessionDigestSecret',
      { generateSecretString: { excludePunctuation: true } },
    );
    const passwordPepperSecret = new secretsmanager.Secret(
      this,
      'PasswordPepperSecret',
      { generateSecretString: { excludePunctuation: true } },
    );
    const verificationDigestSecret = new secretsmanager.Secret(
      this,
      'VerificationDigestSecret',
      { generateSecretString: { excludePunctuation: true } },
    );
    const externalAuthTransactionSecret = new secretsmanager.Secret(
      this,
      'ExternalAuthTransactionSecret',
      {
        generateSecretString: { excludePunctuation: true, passwordLength: 64 },
      },
    );
    const resendSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'ResendSecret',
      (this.node.tryGetContext('resendSecretName') as string | undefined) ??
        `/hansel/${props.stage}/resend`,
    );
    const externalAuthSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'ExternalAuthSecret',
      (this.node.tryGetContext('externalAuthSecretName') as
        string | undefined) ?? `/hansel/${props.stage}/external-auth`,
    );
    const database = new rds.DatabaseCluster(this, 'Database', {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_6,
      }),
      credentials: rds.Credentials.fromSecret(databaseSecret),
      writer: rds.ClusterInstance.serverlessV2('writer'),
      readers: production
        ? [
            rds.ClusterInstance.serverlessV2('reader', {
              scaleWithWriter: true,
            }),
          ]
        : [],
      serverlessV2MinCapacity: 0.5,
      serverlessV2MaxCapacity: production ? 16 : 2,
      defaultDatabaseName: 'hansel',
      storageEncrypted: true,
      deletionProtection: production,
      backup: { retention: cdk.Duration.days(production ? 35 : 7) },
      cloudwatchLogsExports: ['postgresql'],
      cloudwatchLogsRetention: logs.RetentionDays.ONE_MONTH,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_ISOLATED },
      removalPolicy,
    });

    const cluster = new ecs.Cluster(this, 'Cluster', {
      vpc,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });
    const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy,
    });
    const api = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      'Api',
      {
        cluster,
        cpu: 512,
        memoryLimitMiB: 1024,
        desiredCount: production ? 2 : 1,
        publicLoadBalancer: true,
        taskSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        circuitBreaker: { rollback: true },
        minHealthyPercent: 100,
        taskImageOptions: {
          image: ecs.ContainerImage.fromAsset(
            path.resolve(import.meta.dirname, '../..'),
            {
              file: 'apps/api/Dockerfile',
              exclude: [
                '.git',
                'node_modules',
                'infra/cdk.out',
                '**/coverage',
                '**/dist',
              ],
              ignoreMode: cdk.IgnoreMode.GLOB,
            },
          ),
          containerPort: 3000,
          logDriver: ecs.LogDrivers.awsLogs({
            logGroup: apiLogGroup,
            streamPrefix: 'api',
          }),
          environment: {
            PORT: '3000',
            DB_HOST: database.clusterEndpoint.hostname,
            DB_PORT: database.clusterEndpoint.port.toString(),
            DB_NAME: 'hansel',
            EMAIL_DELIVERY_MODE: 'resend',
            DISCOVERY_ENABLED: production ? 'false' : 'true',
            DASHBOARD_ENABLED: production ? 'false' : 'true',
            LOGIN_ENABLED: loginEnabled ? 'true' : 'false',
            PASSWORD_RECOVERY_ENABLED: passwordRecoveryEnabled
              ? 'true'
              : 'false',
            EXTERNAL_AUTH_ENABLED: externalAuthEnabled ? 'true' : 'false',
            WELCOME_EMAIL_ENABLED: welcomeEmailEnabled ? 'true' : 'false',
            ...(externalAuthEnabled
              ? {
                  APPLE_CALLBACK_URL:
                    configuredAppleCallbackUrl ??
                    `https://${domainName ?? 'app.hanselapp.io'}/auth/callback/apple`,
                }
              : {}),
          },
          secrets: {
            APPLICATION_SESSION_DIGEST_KEY: ecs.Secret.fromSecretsManager(
              applicationSessionDigestSecret,
            ),
            PASSWORD_PEPPER:
              ecs.Secret.fromSecretsManager(passwordPepperSecret),
            VERIFICATION_DIGEST_KEY: ecs.Secret.fromSecretsManager(
              verificationDigestSecret,
            ),
            EXTERNAL_AUTH_TRANSACTION_KEY: ecs.Secret.fromSecretsManager(
              externalAuthTransactionSecret,
            ),
            RESEND_API_KEY: ecs.Secret.fromSecretsManager(
              resendSecret,
              'apiKey',
            ),
            RESEND_FROM_EMAIL: ecs.Secret.fromSecretsManager(
              resendSecret,
              'fromEmail',
            ),
            DB_USERNAME: ecs.Secret.fromSecretsManager(
              databaseSecret,
              'username',
            ),
            DB_PASSWORD: ecs.Secret.fromSecretsManager(
              databaseSecret,
              'password',
            ),
            ...(externalAuthEnabled
              ? {
                  GOOGLE_CLIENT_ID: ecs.Secret.fromSecretsManager(
                    externalAuthSecret,
                    'googleClientId',
                  ),
                  GOOGLE_CLIENT_SECRET: ecs.Secret.fromSecretsManager(
                    externalAuthSecret,
                    'googleClientSecret',
                  ),
                  MICROSOFT_CLIENT_ID: ecs.Secret.fromSecretsManager(
                    externalAuthSecret,
                    'microsoftClientId',
                  ),
                  MICROSOFT_CLIENT_SECRET: ecs.Secret.fromSecretsManager(
                    externalAuthSecret,
                    'microsoftClientSecret',
                  ),
                  MICROSOFT_TENANT_ID: ecs.Secret.fromSecretsManager(
                    externalAuthSecret,
                    'microsoftTenantId',
                  ),
                  APPLE_CLIENT_ID: ecs.Secret.fromSecretsManager(
                    externalAuthSecret,
                    'appleClientId',
                  ),
                  APPLE_TEAM_ID: ecs.Secret.fromSecretsManager(
                    externalAuthSecret,
                    'appleTeamId',
                  ),
                  APPLE_KEY_ID: ecs.Secret.fromSecretsManager(
                    externalAuthSecret,
                    'appleKeyId',
                  ),
                  APPLE_PRIVATE_KEY: ecs.Secret.fromSecretsManager(
                    externalAuthSecret,
                    'applePrivateKey',
                  ),
                }
              : {}),
          },
        },
      },
    );
    if (migrationBootstrap)
      (api.service.node.defaultChild as ecs.CfnService).desiredCount = 0;
    api.targetGroup.configureHealthCheck({
      path: '/api/health',
      healthyHttpCodes: '200',
    });
    api.service.enableDeploymentAlarms(['Api5xxAlarm'], {
      behavior: ecs.AlarmBehavior.ROLLBACK_ON_ALARM,
    });
    database.connections.allowDefaultPortFrom(api.service);
    if (!migrationBootstrap) {
      const scalable = api.service.autoScaleTaskCount({
        minCapacity: production ? 2 : 1,
        maxCapacity: production ? 20 : 4,
      });
      scalable.scaleOnCpuUtilization('CpuScaling', {
        targetUtilizationPercent: 60,
      });
      scalable.scaleOnRequestCount('RequestScaling', {
        requestsPerTarget: 1000,
        targetGroup: api.targetGroup,
      });
    }

    const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      metric: api.loadBalancer.metrics.httpCodeElb(
        elbv2.HttpCodeElb.ELB_5XX_COUNT,
      ),
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    const catalogFailureFilter = new logs.MetricFilter(
      this,
      'PlanCatalogFailureMetric',
      {
        logGroup: apiLogGroup,
        filterPattern: logs.FilterPattern.stringValue(
          '$.message',
          '=',
          'plan_catalog_validation_failed',
        ),
        metricNamespace: 'Hansel/Onboarding',
        metricName: 'PlanCatalogValidationFailures',
        metricValue: '1',
      },
    );
    new cloudwatch.Alarm(this, 'PlanCatalogFailureAlarm', {
      metric: catalogFailureFilter.metric(),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    const planUnexpectedFailureFilter = new logs.MetricFilter(
      this,
      'PlanUnexpectedFailureMetric',
      {
        logGroup: apiLogGroup,
        filterPattern: logs.FilterPattern.stringValue(
          '$.message',
          '=',
          'plan_selection_unexpected_failure',
        ),
        metricNamespace: 'Hansel/Onboarding',
        metricName: 'PlanSelectionUnexpectedFailures',
        metricValue: '1',
      },
    );
    new cloudwatch.Alarm(this, 'PlanUnexpectedFailureAlarm', {
      metric: planUnexpectedFailureFilter.metric(),
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    const organizationUnexpectedFailureFilter = new logs.MetricFilter(
      this,
      'OrganizationUnexpectedFailureMetric',
      {
        logGroup: apiLogGroup,
        filterPattern: logs.FilterPattern.stringValue(
          '$.message',
          '=',
          'organization_profile_unexpected_failure',
        ),
        metricNamespace: 'Hansel/Onboarding',
        metricName: 'OrganizationProfileUnexpectedFailures',
        metricValue: '1',
      },
    );
    new cloudwatch.Alarm(this, 'OrganizationUnexpectedFailureAlarm', {
      metric: organizationUnexpectedFailureFilter.metric(),
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    const discoveryUnexpectedFailureFilter = new logs.MetricFilter(
      this,
      'DiscoveryUnexpectedFailureMetric',
      {
        logGroup: apiLogGroup,
        filterPattern: logs.FilterPattern.stringValue(
          '$.message',
          '=',
          'discovery_unexpected_failure',
        ),
        metricNamespace: 'Hansel/Onboarding',
        metricName: 'DiscoveryUnexpectedFailures',
        metricValue: '1',
      },
    );
    new cloudwatch.Alarm(this, 'DiscoveryUnexpectedFailureAlarm', {
      metric: discoveryUnexpectedFailureFilter.metric(),
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    const dashboardUnexpectedFailureFilter = new logs.MetricFilter(
      this,
      'DashboardUnexpectedFailureMetric',
      {
        logGroup: apiLogGroup,
        filterPattern: logs.FilterPattern.stringValue(
          '$.message',
          '=',
          'dashboard_unexpected_failure',
        ),
        metricNamespace: 'Hansel/Dashboard',
        metricName: 'DashboardUnexpectedFailures',
        metricValue: '1',
      },
    );
    new cloudwatch.Alarm(this, 'DashboardUnexpectedFailureAlarm', {
      metric: dashboardUnexpectedFailureFilter.metric(),
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    const dashboardRefreshFailureFilter = new logs.MetricFilter(
      this,
      'DashboardRefreshFailureMetric',
      {
        logGroup: apiLogGroup,
        filterPattern: logs.FilterPattern.stringValue(
          '$.message',
          '=',
          'dashboard_refresh_failed',
        ),
        metricNamespace: 'Hansel/Dashboard',
        metricName: 'DashboardRefreshFailures',
        metricValue: '1',
      },
    );
    new cloudwatch.Alarm(this, 'DashboardRefreshFailureAlarm', {
      metric: dashboardRefreshFailureFilter.metric(),
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    const welcomeMetric = (
      id: string,
      message: string,
      metricName: string,
      metricValue = '1',
    ) =>
      new logs.MetricFilter(this, id, {
        logGroup: apiLogGroup,
        filterPattern: logs.FilterPattern.stringValue(
          '$.message',
          '=',
          message,
        ),
        metricNamespace: 'Hansel/Onboarding',
        metricName,
        metricValue,
      });
    const welcomeEmailCreatedFilter = welcomeMetric(
      'WelcomeEmailCreatedMetric',
      'welcome_email_intent_created',
      'WelcomeEmailCreated',
    );
    const welcomeEmailClaimedFilter = welcomeMetric(
      'WelcomeEmailClaimedMetric',
      'welcome_email_claimed',
      'WelcomeEmailClaimed',
    );
    const welcomeEmailDeliveredFilter = welcomeMetric(
      'WelcomeEmailDeliveredMetric',
      'welcome_email_delivered',
      'WelcomeEmailDelivered',
    );
    const welcomeEmailTransientFilter = welcomeMetric(
      'WelcomeEmailTransientMetric',
      'welcome_email_transient_failure',
      'WelcomeEmailTransientFailures',
    );
    const welcomeEmailLeaseRecoveryFilter = welcomeMetric(
      'WelcomeEmailLeaseRecoveryMetric',
      'welcome_email_lease_recovered',
      'WelcomeEmailLeaseRecoveries',
    );
    const welcomeEmailExhaustedFilter = welcomeMetric(
      'WelcomeEmailExhaustedMetric',
      'welcome_email_retry_exhausted',
      'WelcomeEmailRetryExhausted',
    );
    const welcomeEmailAttemptsFilter = welcomeMetric(
      'WelcomeEmailAttemptsMetric',
      'welcome_email_claimed',
      'WelcomeEmailAttemptCount',
      '$.attempt',
    );
    const welcomeEmailTerminalFilter = new logs.MetricFilter(
      this,
      'WelcomeEmailTerminalMetric',
      {
        logGroup: apiLogGroup,
        filterPattern: logs.FilterPattern.any(
          logs.FilterPattern.stringValue(
            '$.message',
            '=',
            'welcome_email_provider_permanent',
          ),
          logs.FilterPattern.stringValue(
            '$.message',
            '=',
            'welcome_email_retry_exhausted',
          ),
          logs.FilterPattern.stringValue(
            '$.message',
            '=',
            'welcome_email_ambiguous_window_exhausted',
          ),
          logs.FilterPattern.stringValue(
            '$.message',
            '=',
            'welcome_email_retry_window_exhausted',
          ),
          logs.FilterPattern.stringValue(
            '$.message',
            '=',
            'welcome_email_profile_unavailable',
          ),
        ),
        metricNamespace: 'Hansel/Onboarding',
        metricName: 'WelcomeEmailTerminalFailures',
        metricValue: '1',
      },
    );
    new cloudwatch.Alarm(this, 'WelcomeEmailTerminalAlarm', {
      metric: welcomeEmailTerminalFilter.metric(),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    const welcomeEmailPendingFilter = new logs.MetricFilter(
      this,
      'WelcomeEmailPendingMetric',
      {
        logGroup: apiLogGroup,
        filterPattern: logs.FilterPattern.stringValue(
          '$.message',
          '=',
          'welcome_email_pending_age_observed',
        ),
        metricNamespace: 'Hansel/Onboarding',
        metricName: 'WelcomeEmailOldestPendingAgeSeconds',
        metricValue: '$.ageSeconds',
      },
    );
    new cloudwatch.Alarm(this, 'WelcomeEmailPendingAlarm', {
      metric: welcomeEmailPendingFilter.metric({
        statistic: cloudwatch.Stats.MAXIMUM,
      }),
      threshold: 15 * 60,
      evaluationPeriods: 1,
      treatMissingData: welcomeEmailEnabled
        ? cloudwatch.TreatMissingData.BREACHING
        : cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    const authMetric = (id: string, message: string, metricName: string) =>
      new logs.MetricFilter(this, id, {
        logGroup: apiLogGroup,
        filterPattern: logs.FilterPattern.stringValue(
          '$.message',
          '=',
          message,
        ),
        metricNamespace: 'Hansel/Authentication',
        metricName,
        metricValue: '1',
      });
    const loginRejectionFilter = authMetric(
      'LoginRejectionMetric',
      'password_login_rejected',
      'PasswordLoginRejections',
    );
    const externalRejectionFilter = authMetric(
      'ExternalRejectionMetric',
      'external_login_rejected',
      'ExternalLoginRejections',
    );
    const lockEmailTerminalFilter = authMetric(
      'PasswordLockEmailTerminalMetric',
      'password_lock_email_terminal_failure',
      'PasswordLockEmailTerminalFailures',
    );
    const loginUnexpectedFilter = authMetric(
      'LoginUnexpectedMetric',
      'password_login_unexpected_failure',
      'PasswordLoginUnexpectedFailures',
    );
    const providerUnavailableFilter = authMetric(
      'ExternalProviderUnavailableMetric',
      'external_provider_unavailable',
      'ExternalProviderUnavailable',
    );
    const recoverySuppressedFilter = authMetric(
      'PasswordRecoverySuppressedMetric',
      'password_recovery_request_suppressed',
      'PasswordRecoveryRequestsSuppressed',
    );
    const recoveryAcceptedFilter = authMetric(
      'PasswordRecoveryAcceptedMetric',
      'password_recovery_request_accepted',
      'PasswordRecoveryRequestsAccepted',
    );
    const recoveryEmailAttemptedFilter = authMetric(
      'PasswordRecoveryEmailAttemptedMetric',
      'password_recovery_email_attempted',
      'PasswordRecoveryEmailsAttempted',
    );
    const recoveryEmailSentFilter = authMetric(
      'PasswordRecoveryEmailSentMetric',
      'password_recovery_email_sent',
      'PasswordRecoveryEmailsSent',
    );
    const recoveryEmailFailedFilter = authMetric(
      'PasswordRecoveryEmailFailedMetric',
      'password_recovery_email_failed',
      'PasswordRecoveryEmailFailures',
    );
    const resetSucceededFilter = authMetric(
      'PasswordResetSucceededMetric',
      'password_reset_succeeded',
      'PasswordResetsSucceeded',
    );
    const resetRejectedFilter = authMetric(
      'PasswordResetRejectedMetric',
      'password_reset_rejected',
      'PasswordResetsRejected',
    );
    const recoveryUnexpectedFilter = authMetric(
      'PasswordRecoveryUnexpectedMetric',
      'password_recovery_unexpected_failure',
      'PasswordRecoveryUnexpectedFailures',
    );
    const resetUnexpectedFilter = authMetric(
      'PasswordResetUnexpectedMetric',
      'password_reset_unexpected_failure',
      'PasswordResetUnexpectedFailures',
    );
    const resetUnavailableFilter = authMetric(
      'PasswordResetUnavailableMetric',
      'password_reset_unavailable',
      'PasswordResetUnavailable',
    );
    const recoverySessionsRevokedFilter = new logs.MetricFilter(
      this,
      'PasswordRecoverySessionsRevokedMetric',
      {
        logGroup: apiLogGroup,
        filterPattern: logs.FilterPattern.stringValue(
          '$.message',
          '=',
          'password_recovery_sessions_revoked',
        ),
        metricNamespace: 'Hansel/Authentication',
        metricName: 'PasswordRecoverySessionsRevoked',
        metricValue: '$.count',
      },
    );
    const resetNotificationCreatedFilter = authMetric(
      'PasswordResetNotificationCreatedMetric',
      'password_reset_notification_created',
      'PasswordResetNotificationsCreated',
    );
    const resetNotificationTerminalFilter = authMetric(
      'PasswordResetNotificationTerminalMetric',
      'password_reset_notification_terminal_failure',
      'PasswordResetNotificationTerminalFailures',
    );
    const resetNotificationPendingFilter = new logs.MetricFilter(
      this,
      'PasswordResetNotificationPendingMetric',
      {
        logGroup: apiLogGroup,
        filterPattern: logs.FilterPattern.stringValue(
          '$.message',
          '=',
          'password_reset_notification_pending_age_observed',
        ),
        metricNamespace: 'Hansel/Authentication',
        metricName: 'PasswordResetNotificationOldestPendingAgeSeconds',
        metricValue: '$.ageSeconds',
      },
    );
    new cloudwatch.Alarm(this, 'LoginRejectionSpikeAlarm', {
      metric: loginRejectionFilter.metric(),
      threshold: 50,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    new cloudwatch.Alarm(this, 'ExternalRejectionSpikeAlarm', {
      metric: externalRejectionFilter.metric(),
      threshold: 20,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    new cloudwatch.Alarm(this, 'PasswordLockEmailTerminalAlarm', {
      metric: lockEmailTerminalFilter.metric(),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    new cloudwatch.Alarm(this, 'LoginUnexpectedAlarm', {
      metric: loginUnexpectedFilter.metric(),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    new cloudwatch.Alarm(this, 'ExternalProviderUnavailableAlarm', {
      metric: providerUnavailableFilter.metric(),
      threshold: 5,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    new cloudwatch.Alarm(this, 'PasswordRecoveryUnexpectedAlarm', {
      metric: recoveryUnexpectedFilter.metric(),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    new cloudwatch.Alarm(this, 'PasswordResetUnexpectedAlarm', {
      metric: resetUnexpectedFilter.metric(),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    new cloudwatch.Alarm(this, 'PasswordResetNotificationTerminalAlarm', {
      metric: resetNotificationTerminalFilter.metric(),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    new cloudwatch.Alarm(this, 'PasswordResetNotificationPendingAlarm', {
      metric: resetNotificationPendingFilter.metric({
        statistic: cloudwatch.Stats.MAXIMUM,
      }),
      threshold: 15 * 60,
      evaluationPeriods: 1,
      treatMissingData: passwordRecoveryEnabled
        ? cloudwatch.TreatMissingData.BREACHING
        : cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    const dashboard = new cloudwatch.Dashboard(this, 'OperationsDashboard');
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API requests',
        left: [api.loadBalancer.metrics.requestCount()],
      }),
      new cloudwatch.GraphWidget({
        title: 'API 5xx',
        left: [api5xxAlarm.metric],
      }),
      new cloudwatch.GraphWidget({
        title: 'Database connections',
        left: [database.metricDatabaseConnections()],
      }),
      new cloudwatch.GraphWidget({
        title: 'Dashboard failures',
        left: [
          dashboardUnexpectedFailureFilter.metric(),
          dashboardRefreshFailureFilter.metric(),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Welcome email delivery',
        left: [
          welcomeEmailCreatedFilter.metric(),
          welcomeEmailClaimedFilter.metric(),
          welcomeEmailDeliveredFilter.metric(),
          welcomeEmailTransientFilter.metric(),
          welcomeEmailLeaseRecoveryFilter.metric(),
          welcomeEmailExhaustedFilter.metric(),
          welcomeEmailAttemptsFilter.metric({
            statistic: cloudwatch.Stats.MAXIMUM,
          }),
          welcomeEmailTerminalFilter.metric(),
          welcomeEmailPendingFilter.metric({
            statistic: cloudwatch.Stats.MAXIMUM,
          }),
        ],
      }),
      new cloudwatch.GraphWidget({
        title: 'Authentication safety',
        left: [
          loginRejectionFilter.metric(),
          externalRejectionFilter.metric(),
          lockEmailTerminalFilter.metric(),
          loginUnexpectedFilter.metric(),
          providerUnavailableFilter.metric(),
          recoverySuppressedFilter.metric(),
          recoveryAcceptedFilter.metric(),
          recoveryEmailAttemptedFilter.metric(),
          recoveryEmailSentFilter.metric(),
          recoveryEmailFailedFilter.metric(),
          resetSucceededFilter.metric(),
          resetRejectedFilter.metric(),
          recoveryUnexpectedFilter.metric(),
          resetUnexpectedFilter.metric(),
          resetUnavailableFilter.metric(),
          recoverySessionsRevokedFilter.metric(),
          resetNotificationCreatedFilter.metric(),
          resetNotificationTerminalFilter.metric(),
          resetNotificationPendingFilter.metric({
            statistic: cloudwatch.Stats.MAXIMUM,
          }),
          api.loadBalancer.metrics.targetResponseTime({
            statistic: 'p95',
          }),
        ],
      }),
    );

    const webBucket = new s3.Bucket(this, 'WebBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      versioned: production,
      removalPolicy,
      autoDeleteObjects: !production,
    });
    const webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      defaultAction: { allow: {} },
      scope: 'REGIONAL',
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `hansel-${props.stage}`,
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'AWSManagedCommon',
          priority: 0,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'common',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AuthenticationRateLimit',
          priority: 1,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              aggregateKeyType: 'IP',
              limit: 300,
              evaluationWindowSec: 300,
              scopeDownStatement: {
                orStatement: {
                  statements: ['/api/auth', '/auth/'].map((searchString) => ({
                    byteMatchStatement: {
                      fieldToMatch: { uriPath: {} },
                      positionalConstraint: 'STARTS_WITH',
                      searchString,
                      textTransformations: [{ priority: 0, type: 'NONE' }],
                    },
                  })),
                },
              },
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'authentication-rate-limit',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedIpReputation',
          priority: 2,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesAmazonIpReputationList',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'ip-reputation',
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'RateLimit',
          priority: 3,
          action: { block: {} },
          statement: {
            rateBasedStatement: { aggregateKeyType: 'IP', limit: 2000 },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: 'rate-limit',
            sampledRequestsEnabled: true,
          },
        },
      ],
    });
    new wafv2.CfnWebACLAssociation(this, 'ApiWebAclAssociation', {
      resourceArn: api.loadBalancer.loadBalancerArn,
      webAclArn: webAcl.attrArn,
    });
    const certificate = certificateArn
      ? acm.Certificate.fromCertificateArn(
          this,
          'DistributionCertificate',
          certificateArn,
        )
      : undefined;
    const apiOrigin = new origins.LoadBalancerV2Origin(api.loadBalancer, {
      protocolPolicy: cloudfront.OriginProtocolPolicy.HTTP_ONLY,
    });
    const apiBehavior = {
      origin: apiOrigin,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      originRequestPolicy:
        cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    };
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(webBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        responseHeadersPolicy:
          cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      },
      additionalBehaviors: {
        'api/*': apiBehavior,
        login: {
          ...apiBehavior,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
        'forgot-password': {
          ...apiBehavior,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
        'reset-password': {
          ...apiBehavior,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
        'auth/*': apiBehavior,
        'onboarding/about-you': {
          ...apiBehavior,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
        'onboarding/plan-selection': {
          ...apiBehavior,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
        'onboarding/organization-profile': {
          ...apiBehavior,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
        'onboarding/discovery': {
          ...apiBehavior,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        },
        health: {
          origin: apiOrigin,
          allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
          cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
          originRequestPolicy:
            cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        },
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(1),
        },
      ],
      ...(certificate && domainName
        ? {
            certificate,
            domainNames: [domainName],
            minimumProtocolVersion:
              cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
          }
        : {}),
      enableLogging: true,
    });
    api.taskDefinition.defaultContainer?.addEnvironment(
      'ALLOWED_ORIGIN',
      domainName
        ? `https://${domainName}`
        : `https://${distribution.distributionDomainName}`,
    );

    if (this.node.tryGetContext('deployWeb') === 'true') {
      new s3deploy.BucketDeployment(this, 'WebDeployment', {
        sources: [
          s3deploy.Source.asset(
            path.resolve(import.meta.dirname, '../../apps/web/dist'),
          ),
        ],
        destinationBucket: webBucket,
        distribution,
        distributionPaths: ['/*'],
      });
    }

    new cdk.CfnOutput(this, 'ApplicationUrl', {
      value: `https://${distribution.distributionDomainName}`,
    });
    new cdk.CfnOutput(this, 'DashboardName', {
      value: dashboard.dashboardName,
    });
    new cdk.CfnOutput(this, 'EcsClusterName', {
      value: cluster.clusterName,
    });
    new cdk.CfnOutput(this, 'ApiServiceName', {
      value: api.service.serviceName,
    });
    new cdk.CfnOutput(this, 'ApiContainerName', {
      value: api.taskDefinition.defaultContainer?.containerName ?? 'web',
    });
  }
}
