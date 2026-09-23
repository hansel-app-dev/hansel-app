import * as cdk from 'aws-cdk-lib';
import {
  aws_lightsail as lightsail,
  aws_s3 as s3,
  aws_iam as iam,
  aws_budgets as budgets,
} from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { readFileSync } from 'node:fs';
import { isIPv4 } from 'node:net';

export interface SandboxInputs extends cdk.StackProps {
  stage: string;
  operatorCidr: string;
  keyPairName: string;
  budgetEmail?: string;
}
export function validateSandboxInputs(input: SandboxInputs): void {
  if (input.stage !== 'sandbox')
    throw new Error('This entry point only supports sandbox');
  const [address, mask] = input.operatorCidr.split('/');
  if (!address || !isIPv4(address) || mask !== '32')
    throw new Error('Provide the operator IPv4 /32 CIDR');
  if (
    !/^hansel-sandbox[-a-zA-Z0-9]*$/.test(input.keyPairName) ||
    ['hansel-sandbox', 'hansel-sandbox-ip'].includes(input.keyPairName)
  )
    throw new Error('Use a dedicated hansel-sandbox key pair');
  if (
    input.budgetEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.budgetEmail)
  )
    throw new Error('Invalid budget email');
}
export class SandboxStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: SandboxInputs) {
    validateSandboxInputs(props);
    super(scope, id, props);
    cdk.Tags.of(this).add('Project', 'HanselSandbox');
    cdk.Tags.of(this).add('Environment', 'sandbox');
    const instance = new lightsail.CfnInstance(this, 'Server', {
      instanceName: 'hansel-sandbox',
      blueprintId: 'ubuntu_24_04',
      bundleId: 'medium_3_2',
      keyPairName: props.keyPairName,
      userData: readFileSync(
        new URL('../../deploy/sandbox/bootstrap.sh', import.meta.url),
        'utf8',
      ),
      networking: {
        ports: [
          {
            fromPort: 22,
            toPort: 22,
            protocol: 'tcp',
            cidrs: [props.operatorCidr],
          },
          { fromPort: 80, toPort: 80, protocol: 'tcp', cidrs: ['0.0.0.0/0'] },
          { fromPort: 443, toPort: 443, protocol: 'tcp', cidrs: ['0.0.0.0/0'] },
        ],
      },
      addOns: [
        {
          addOnType: 'AutoSnapshot',
          status: 'Enabled',
          autoSnapshotAddOnRequest: { snapshotTimeOfDay: '15:00' },
        },
      ],
    });
    instance.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    const ip = new lightsail.CfnStaticIp(this, 'Address', {
      staticIpName: 'hansel-sandbox-ip',
      attachedTo: instance.ref,
    });
    ip.applyRemovalPolicy(cdk.RemovalPolicy.RETAIN);
    const bucketProps: s3.BucketProps = {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    };
    const uploads = new s3.Bucket(this, 'Uploads', {
      ...bucketProps,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.PUT],
          allowedOrigins: [`https://${ip.attrIpAddress}`],
          allowedHeaders: ['*'],
          exposedHeaders: ['ETag'],
        },
      ],
      lifecycleRules: [
        {
          prefix: 'quarantine/',
          expiration: cdk.Duration.days(1),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
    });
    const backups = new s3.Bucket(this, 'Backups', {
      ...bucketProps,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(7),
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        },
      ],
    });
    const runtime = new iam.User(this, 'RuntimeUser', {
      userName: 'hansel-sandbox-storage',
    });
    for (const prefix of [
      'quarantine',
      'plans',
      'sign-documents',
      'sign-photos',
      'sign-comments',
      'plan-comments',
      'covers',
    ])
      uploads.grantReadWrite(runtime, `${prefix}/*`);
    const backupUser = new iam.User(this, 'BackupUser', {
      userName: 'hansel-sandbox-backups',
    });
    backups.grantPut(backupUser, 'database/*');
    const budgetEmail = props.budgetEmail;
    if (budgetEmail)
      new budgets.CfnBudget(this, 'Budget', {
        budget: {
          budgetName: 'hansel-sandbox',
          budgetType: 'COST',
          timeUnit: 'MONTHLY',
          budgetLimit: { amount: 50, unit: 'USD' },
          costFilters: { TagKeyValue: ['user:Project$HanselSandbox'] },
        },
        notificationsWithSubscribers: ['ACTUAL', 'FORECASTED'].map(
          (notificationType) => ({
            notification: {
              notificationType,
              comparisonOperator: 'GREATER_THAN',
              threshold: 80,
              thresholdType: 'PERCENTAGE',
            },
            subscribers: [{ subscriptionType: 'EMAIL', address: budgetEmail }],
          }),
        ),
      });
    new cdk.CfnOutput(this, 'SandboxIp', { value: ip.attrIpAddress });
    new cdk.CfnOutput(this, 'ApplicationUrl', {
      value: `https://${ip.attrIpAddress}`,
    });
    new cdk.CfnOutput(this, 'UploadsBucket', { value: uploads.bucketName });
    new cdk.CfnOutput(this, 'BackupsBucket', { value: backups.bucketName });
  }
}
