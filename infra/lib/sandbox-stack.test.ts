import * as cdk from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { describe, expect, it } from 'vitest';
import { SandboxStack, validateSandboxInputs } from './sandbox-stack.js';

const inputs = {
  stage: 'sandbox',
  operatorCidr: '203.0.113.1/32',
  keyPairName: 'hansel-sandbox',
  budgetEmail: 'operator@example.com',
};
describe('Lightsail sandbox [lightsail-sandbox REQ-001–009]', () => {
  it('rejects production and unsafe network inputs [REQ-001,002,003]', () => {
    for (const override of [
      { stage: 'production' },
      { operatorCidr: '0.0.0.0/0' },
      { operatorCidr: '999.1.1.1/32' },
      { keyPairName: '' },
    ])
      expect(() => {
        validateSandboxInputs({ ...inputs, ...override });
      }).toThrow();
  });
  it('isolates low-cost infrastructure and data [REQ-002,004,006,007,008]', () => {
    const app = new cdk.App();
    const output = Template.fromStack(
      new SandboxStack(app, 'Hansel-sandbox', inputs),
    );
    output.resourceCountIs('AWS::Lightsail::Instance', 1);
    output.hasResourceProperties('AWS::Lightsail::Instance', {
      BundleId: 'medium_3_2',
      BlueprintId: 'ubuntu_24_04',
      Networking: {
        Ports: [
          {
            FromPort: 22,
            ToPort: 22,
            Protocol: 'tcp',
            Cidrs: ['203.0.113.1/32'],
          },
          { FromPort: 80, ToPort: 80, Protocol: 'tcp', Cidrs: ['0.0.0.0/0'] },
          { FromPort: 443, ToPort: 443, Protocol: 'tcp', Cidrs: ['0.0.0.0/0'] },
        ],
      },
      AddOns: [
        {
          AddOnType: 'AutoSnapshot',
          Status: 'Enabled',
          AutoSnapshotAddOnRequest: { SnapshotTimeOfDay: '15:00' },
        },
      ],
    });
    for (const kind of [
      'AWS::ECS::Service',
      'AWS::RDS::DBCluster',
      'AWS::EC2::NatGateway',
      'AWS::ElasticLoadBalancingV2::LoadBalancer',
      'AWS::EC2::VPCEndpoint',
      'AWS::IAM::AccessKey',
    ])
      output.resourceCountIs(kind, 0);
    output.resourceCountIs('AWS::S3::Bucket', 2);
    for (const bucket of Object.values(
      output.findResources('AWS::S3::Bucket'),
    )) {
      expect(bucket.DeletionPolicy).toBe('Retain');
      expect(bucket.Properties.PublicAccessBlockConfiguration).toEqual({
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      });
      expect(bucket.Properties.BucketEncryption).toBeDefined();
    }
    output.hasResourceProperties('AWS::S3::Bucket', {
      LifecycleConfiguration: {
        Rules: Match.arrayWith([Match.objectLike({ ExpirationInDays: 7 })]),
      },
    });
    output.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: Match.objectLike({
        BudgetLimit: { Amount: 50, Unit: 'USD' },
        CostFilters: { TagKeyValue: ['user:Project$HanselSandbox'] },
      }),
    });
    const policies = JSON.stringify(output.findResources('AWS::IAM::Policy'));
    expect(policies).toContain('plan-comments/*');
    expect(policies).not.toContain('s3:*');
  });
});
