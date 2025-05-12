# Serverless MCP Server: Protein Bar Ordering System

This project implements a serverless Model Context Protocol (MCP) server on AWS Lambda that enables AI assistants to interact with a protein bar ordering system.

## Features

- **MCP Server** with tools for:
  - Listing available protein bars
  - Creating new orders
  - Admin functionality for managing orders
- **Serverless Architecture** using:
  - AWS Lambda with Express and Lambda Web Adapter
  - API Gateway for HTTP endpoint
  - DynamoDB for data storage
- **Stateless Design** that scales efficiently

## Prerequisites

- Node.js 22 or higher
- AWS CLI configured with appropriate permissions
- AWS CDK installed (`npm install -g aws-cdk`)

## Setup and Deployment

### 1. Install Dependencies

```bash
npm install
```

### 2. Build the Project

```bash
npm run build
```

### 3. Deploy to AWS

```bash
npm run cdk bootstrap  # Only needed first time
npm run deploy
```

The CDK deployment will output:

- The API Gateway URL
- The MCP Server URL (used for client configuration)

### 4. Seed Initial Data

After deployment, seed the DynamoDB table with initial protein bar data:

```bash
# Set your AWS_PROFILE if needed
export PRODUCTS_TABLE=protein_products  # Should match the table name in CDK stack
npm run seed-data
```

## Testing Locally

To run the MCP server locally for testing:

```bash
npm run dev
```

This will start the server on port 3000, and you can send MCP requests to `http://localhost:3000/mcp`.

## Connecting Clients

### VS Code (Copilot Agent Mode)

1. Enable GitHub Copilot Chat and Agent Mode in VS Code
2. Create a `.vscode/mcp.json` file with:

```json
{
  "servers": {
    "ProteinBarMCP": {
      "type": "http",
      "url": "https://your-api-id.execute-api.your-region.amazonaws.com/prod/mcp"
    }
  }
}
```

3. Reload VS Code and start a conversation with GitHub Copilot
4. You can now use the protein bar tools in your AI interactions

### Claude Desktop

As of 2025, Claude Desktop has limited support for remote MCP servers, but you can:

1. Check for the latest Claude updates that might support direct remote connections
2. Alternatively, use a local proxy that forwards requests to your AWS MCP server

## Security Considerations

For a production deployment, you should add:

1. API Key authentication for both public and admin endpoints
2. IAM roles with least privilege for the Lambda function
3. VPC configuration if needed
4. Proper error handling and logging

## License

MIT
# protein-bars-mcp-server
