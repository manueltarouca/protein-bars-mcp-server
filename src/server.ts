import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { GetPromptResult, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

const ddbClient = new DynamoDBClient({ region: 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(ddbClient);

const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE || 'protein_products';
const ORDERS_TABLE = process.env.ORDERS_TABLE || 'protein_orders';

const server = new McpServer(
  {
    name: 'protein-bar-ordering-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: { logging: {} },
  }
);

interface Product {
  id: string;
  name: string;
  price: number;
  currency: string;
  in_stock: boolean;
  description?: string;
  image_url?: string;
}

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  price_per_item: number;
}

interface Order {
  order_id: string;
  customer_name: string;
  desk_location: string;
  items: OrderItem[];
  total_price: number;
  currency: string;
  status: string;
  payment_details: {
    method: string;
    notes: string;
  };
  created_at: string;
  updated_at: string;
}

function generateOrderId(): string {
  const date = new Date();
  const dateString = date.toISOString().slice(0, 10).replace(/-/g, '');
  const randomPart = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `ORD-${dateString}-${randomPart}`;
}

server.tool(
  'list-products',
  'Get a list of available protein bars',
  {}, // No input parameters needed
  async (): Promise<CallToolResult> => {
    try {
      const response = await docClient.send(
        new QueryCommand({
          TableName: PRODUCTS_TABLE,
          IndexName: 'InStockIndex', // Assuming we have a GSI for in_stock items
          KeyConditionExpression: 'in_stock = :inStock',
          ExpressionAttributeValues: {
            ':inStock': 'true',
          },
        })
      );

      const products = (response.Items as Product[]) || [
        {
          id: 'PZ001',
          name: 'Prozis Bar - Choco Blast',
          price: 2.0,
          currency: 'EUR',
          in_stock: true,
        },
        {
          id: 'PZ002',
          name: 'Prozis Bar - Peanut Butter Power',
          price: 2.0,
          currency: 'EUR',
          in_stock: true,
        },
      ];

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ data: products }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Error fetching products:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Failed to fetch products',
              message: (error as Error).message,
            }),
          },
        ],
      };
    }
  }
);

server.tool(
  'create-order',
  'Submit a new protein bar order',
  {
    customer_name: z.string().describe('Name or fun alias of the customer ordering the protein bars'),
    desk_location: z.string().describe('Desk location where the protein bars should be delivered'),
    items: z
      .array(
        z.object({
          product_id: z.string().describe('ID of the protein bar'),
          quantity: z.number().int().positive().describe('Number of items to order'),
        })
      )
      .describe('List of protein bars and quantities to order'),
    payment_details: z
      .object({
        method: z.string().describe('Payment method (e.g., "MBWAY")'),
        notes: z.string().describe('Payment notes or confirmation'),
      })
      .describe('Details about how payment was made'),
  },
  async (params): Promise<CallToolResult> => {
    try {
      const orderItems: OrderItem[] = [];
      let totalPrice = 0;

      for (const item of params.items) {
        const productResponse = await docClient.send(
          new GetCommand({
            TableName: PRODUCTS_TABLE,
            Key: { id: item.product_id },
          })
        );

        const product = (productResponse.Item as Product) || {
          id: item.product_id,
          name: `Protein Bar ${item.product_id}`,
          price: 2.0,
          currency: 'EUR',
          in_stock: true,
        };

        const orderItem: OrderItem = {
          product_id: product.id,
          name: product.name,
          quantity: item.quantity,
          price_per_item: product.price,
        };

        orderItems.push(orderItem);
        totalPrice += product.price * item.quantity;
      }

      const now = new Date().toISOString();
      const order: Order = {
        order_id: generateOrderId(),
        customer_name: params.customer_name,
        desk_location: params.desk_location,
        items: orderItems,
        total_price: totalPrice,
        currency: 'EUR', // Hardcoded for now
        status: 'pending_confirmation',
        payment_details: {
          method: params.payment_details.method,
          notes: params.payment_details.notes,
        },
        created_at: now,
        updated_at: now,
      };

      await docClient.send(
        new PutCommand({
          TableName: ORDERS_TABLE,
          Item: order,
        })
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                data: {
                  order_id: order.order_id,
                  status: order.status,
                  message: 'Order received. Awaiting payment confirmation and delivery.',
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      console.error('Error creating order:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Failed to create order',
              message: (error as Error).message,
            }),
          },
        ],
      };
    }
  }
);

server.tool(
  'list-orders',
  'Admin function to list protein bar orders',
  {
    status: z.string().optional().describe('Filter orders by status (e.g., "pending_confirmation", "delivered")'),
  },
  async (params): Promise<CallToolResult> => {
    try {
      let response;
      if (params.status) {
        response = await docClient.send(
          new QueryCommand({
            TableName: ORDERS_TABLE,
            IndexName: 'StatusIndex', // Assuming we have a GSI for status

            KeyConditionExpression: '#status = :status',
            ExpressionAttributeNames: {
              '#status': 'status',
            },
            ExpressionAttributeValues: {
              ':status': params.status,
            },
          })
        );
      } else {
        const mockOrders: Order[] = [
          {
            order_id: 'ORD-20250511-001',
            customer_name: "Sérgio 'The Gluteinator' Costa",
            desk_location: 'Marketing - Desk 3B',
            items: [
              {
                product_id: 'PZ001',
                name: 'Prozis Bar - Choco Blast',
                quantity: 2,
                price_per_item: 2.0,
              },
              {
                product_id: 'PZ002',
                name: 'Prozis Bar - Peanut Butter Power',
                quantity: 1,
                price_per_item: 2.0,
              },
            ],
            total_price: 6.0,
            currency: 'EUR',
            status: 'pending_confirmation',
            payment_details: {
              method: 'MBWAY',
              notes: 'Payment sent via MB WAY to 9XXXXXXXX',
            },
            created_at: '2025-05-11T13:00:00Z',
            updated_at: '2025-05-11T13:00:00Z',
          },
        ];

        response = { Items: mockOrders };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                data: response.Items || [],
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      console.error('Error listing orders:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Failed to list orders',
              message: (error as Error).message,
            }),
          },
        ],
      };
    }
  }
);

server.tool(
  'get-order',
  'Admin function to view details of a specific order',
  {
    order_id: z.string().describe('ID of the order to retrieve'),
  },
  async (params): Promise<CallToolResult> => {
    try {
      const response = await docClient.send(
        new GetCommand({
          TableName: ORDERS_TABLE,
          Key: { order_id: params.order_id },
        })
      );

      if (!response.Item) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: 'Order not found',
                message: `No order found with ID ${params.order_id}`,
              }),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                data: response.Item,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      console.error('Error getting order:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Failed to get order',
              message: (error as Error).message,
            }),
          },
        ],
      };
    }
  }
);

server.tool(
  'update-order-status',
  'Admin function to update the status of an order',
  {
    order_id: z.string().describe('ID of the order to update'),
    status: z
      .enum(['pending_confirmation', 'payment_verified', 'preparing_delivery', 'delivered', 'cancelled'])
      .describe('New status for the order'),
  },
  async (params): Promise<CallToolResult> => {
    try {
      const now = new Date().toISOString();

      const response = await docClient.send(
        new UpdateCommand({
          TableName: ORDERS_TABLE,
          Key: { order_id: params.order_id },
          UpdateExpression: 'SET #status = :status, updated_at = :updated_at',
          ExpressionAttributeNames: {
            '#status': 'status',
          },
          ExpressionAttributeValues: {
            ':status': params.status,
            ':updated_at': now,
          },
          ReturnValues: 'ALL_NEW',
        })
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                data: {
                  order_id: params.order_id,
                  new_status: params.status,
                  updated_at: now,
                },
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (error) {
      console.error('Error updating order status:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Failed to update order status',
              message: (error as Error).message,
            }),
          },
        ],
      };
    }
  }
);

server.prompt(
  'welcome',
  'Welcome message explaining available protein bar ordering tools',
  {},
  async (): Promise<GetPromptResult> => {
    return {
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `
Welcome to the Office Protein Bar Ordering System! As an AI assistant, I can help you with the following:

1. View available protein bars in stock
2. Place a new order for protein bars with delivery to your desk
3. For admins: View and manage existing orders

What would you like to do today? For example, you could say:
- "Show me the available protein bars"
- "I'd like to order 2 Choco Blast bars and 1 Peanut Butter Power bar"
- "Check the status of my recent order"
            `,
          },
        },
      ],
    };
  }
);

export default server;
