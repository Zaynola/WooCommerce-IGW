#!/usr/bin/env node

import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { IGWStack } from '../lib/bmo-woo_commerce-igw-stack';

const app = new cdk.App();
new IGWStack(app, 'IGWStack', {
  vpcTagName: 'BMO' as const,
});
app.synth();