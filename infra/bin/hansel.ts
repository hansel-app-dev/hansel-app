#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { HanselStack } from '../lib/hansel-stack.js';

const app = new cdk.App();
const stage = app.node.tryGetContext('stage') as string | undefined;
if (!stage) throw new Error('CDK context "stage" is required');

new HanselStack(app, `Hansel-${stage}`, {
  stage,
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION ?? 'ap-southeast-2',
  },
});
