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
    const domainName = this.node.tryGetContext('domainName') as
      string | undefined;
    const certificateArn = this.node.tryGetContext('certificateArn') as
      string | undefined;
    if (production && (!domainName || !certificateArn)) {
      throw new Error(
        'Production requires domainName and a us-east-1 certificateArn CDK context',
      );
    }
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
          enableLogging: true,
          environment: { PORT: '3000' },
          secrets: {
            DB_USERNAME: ecs.Secret.fromSecretsManager(
              databaseSecret,
              'username',
            ),
            DB_PASSWORD: ecs.Secret.fromSecretsManager(
              databaseSecret,
              'password',
            ),
          },
        },
      },
    );
    api.targetGroup.configureHealthCheck({
      path: '/api/health',
      healthyHttpCodes: '200',
    });
    api.service.enableDeploymentAlarms(['Api5xxAlarm'], {
      behavior: ecs.AlarmBehavior.ROLLBACK_ON_ALARM,
    });
    database.connections.allowDefaultPortFrom(api.service);
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

    const api5xxAlarm = new cloudwatch.Alarm(this, 'Api5xxAlarm', {
      metric: api.loadBalancer.metrics.httpCodeElb(
        elbv2.HttpCodeElb.ELB_5XX_COUNT,
      ),
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
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
          name: 'RateLimit',
          priority: 1,
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
        'onboarding/about-you': {
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
  }
}
