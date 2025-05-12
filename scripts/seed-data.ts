import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';

const region = process.env.AWS_REGION || 'eu-west-1';
const PRODUCTS_TABLE = process.env.PRODUCTS_TABLE || 'protein_products';

const ddbClient = new DynamoDBClient({ region });
const docClient = DynamoDBDocumentClient.from(ddbClient);

const products = [
  {
    id: 'PZ001',
    name: 'Prozis Bar - Choco Blast',
    price: 2.0,
    currency: 'EUR',
    in_stock: 'true',
    description: 'Delicious chocolate protein bar with 20g of protein.',
  },
  {
    id: 'PZ002',
    name: 'Prozis Bar - Peanut Butter Power',
    price: 2.0,
    currency: 'EUR',
    in_stock: 'true',
    description: 'Creamy peanut butter flavor with 19g of protein.',
  },
  {
    id: 'PZ003',
    name: 'Prozis Bar - Vanilla Dream',
    price: 2.0,
    currency: 'EUR',
    in_stock: 'true',
    description: 'Smooth vanilla flavor with 18g of protein and low sugar.',
  },
  {
    id: 'PZ004',
    name: 'Prozis Bar - Berry Blast',
    price: 2.5,
    currency: 'EUR',
    in_stock: 'true',
    description: 'Mixed berry flavors with 17g of protein and real fruit pieces.',
  },
  {
    id: 'PZ005',
    name: 'Prozis Bar - Cookies & Cream',
    price: 2.5,
    currency: 'EUR',
    in_stock: 'true',
    description: 'Cookie chunks in a cream base with 21g of protein.',
  },
];

async function seedData() {
  console.log(`Seeding data to ${PRODUCTS_TABLE}...`);

  for (const product of products) {
    try {
      await docClient.send(
        new PutCommand({
          TableName: PRODUCTS_TABLE,
          Item: product,
        })
      );
      console.log(`Added product: ${product.name}`);
    } catch (error) {
      console.error(`Failed to add product ${product.name}:`, error);
    }
  }

  console.log('Seeding complete!');
}

seedData();
