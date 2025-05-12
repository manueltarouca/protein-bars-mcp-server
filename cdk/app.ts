import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ProteinMcpStack } from './lib/protein-mcp-stack';

const app = new cdk.App();
new ProteinMcpStack(app, 'ProteinMcpStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'eu-west-1',
  },
});
