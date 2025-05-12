// protein-mcp-stack.ts
import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as path from 'path';
import { Construct } from 'constructs';

export class ProteinMcpStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productsTable = new dynamodb.Table(this, 'ProteinProductsTable', {
      tableName: 'protein_products',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    productsTable.addGlobalSecondaryIndex({
      indexName: 'InStockIndex',
      partitionKey: { name: 'in_stock', type: dynamodb.AttributeType.STRING },
    });

    const ordersTable = new dynamodb.Table(this, 'ProteinOrdersTable', {
      tableName: 'protein_orders',
      partitionKey: { name: 'order_id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    ordersTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
    });

    const adapterLayer = lambda.LayerVersion.fromLayerVersionArn(
      this,
      'WebAdapterLayer',
      'arn:aws:lambda:eu-west-1:753240598075:layer:LambdaAdapterLayerX86:25'
    );

    const mcpFunction = new lambdaNodejs.NodejsFunction(this, 'ProteinMcpFunction', {
      runtime: lambda.Runtime.NODEJS_22_X,
      memorySize: 512,
      timeout: cdk.Duration.minutes(2),
      architecture: lambda.Architecture.X86_64,
      entry: path.join(__dirname, '../../', 'src', 'main.ts'),
      bundling: {
        target: 'node22',
        externalModules: ['@aws-sdk/*'],
        commandHooks: {
          afterBundling(inputDir: string, outputDir: string) {
            // Copy the Lambda adapter bootstrap script into bundle
            return [`cp ${inputDir}/run.sh ${outputDir}`];
          },
          beforeBundling: () => [],
          beforeInstall: () => [],
        },
      },
      handler: 'run.sh',
      environment: {
        AWS_LAMBDA_EXEC_WRAPPER: '/opt/bootstrap', // Enable the adapter
        RUST_LOG: 'debug',
        PRODUCTS_TABLE: productsTable.tableName,
        ORDERS_TABLE: ordersTable.tableName,
        NODE_ENV: 'production',
      },
      layers: [adapterLayer],
    });

    productsTable.grantReadWriteData(mcpFunction);
    ordersTable.grantReadWriteData(mcpFunction);

    const api = new apigateway.RestApi(this, 'ProteinMcpApi', {
      restApiName: 'Protein MCP API',
      description: 'API for Protein Bar Ordering MCP Server',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
      },
    });

    const mcpResource = api.root.addResource('mcp');
    mcpResource.addMethod('POST', new apigateway.LambdaIntegration(mcpFunction));

    const healthResource = api.root.addResource('health');
    healthResource.addMethod('GET', new apigateway.LambdaIntegration(mcpFunction));

    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'URL of the API Gateway',
    });

    new cdk.CfnOutput(this, 'McpServerUrl', {
      value: `${api.url}mcp`,
      description: 'MCP Server URL to use in client configurations',
    });
  }
}
