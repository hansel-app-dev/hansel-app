#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SandboxStack } from '../lib/sandbox-stack.js';
const app = new cdk.App();
function context(name: string): string {
  const value: unknown = app.node.tryGetContext(name);
  if (typeof value !== 'string') throw new Error(`Required context: ${name}`);
  return value;
}
new SandboxStack(app, 'Hansel-sandbox', {
  stage: context('stage'),
  operatorCidr: context('operatorCidr'),
  keyPairName: context('keyPairName'),
  ...(app.node.tryGetContext('budgetEmail')
    ? { budgetEmail: context('budgetEmail') }
    : {}),
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'ap-southeast-2' },
});
