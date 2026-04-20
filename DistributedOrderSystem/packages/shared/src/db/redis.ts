import { createClient, RedisClientType } from 'redis';

export async function createRedisClient(url: string): Promise<RedisClientType> {
  const client = createClient({ url });
  
  client.on('error', (err) => console.error('Redis Client Error', err));
  
  await client.connect();
  return client as RedisClientType;
}
