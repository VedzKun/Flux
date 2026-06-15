import { connect, ChannelModel, Channel } from 'amqplib';

export class RabbitMQClient {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private readonly url: string) {}

  async connect() {
    const conn = await connect(this.url);
    this.connection = conn;
    this.channel = await conn.createChannel();
  }

  async publish(exchange: string, routingKey: string, message: any) {
    if (!this.channel) throw new Error('Channel not initialized');
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    this.channel.publish(exchange, routingKey, Buffer.from(JSON.stringify(message)));
  }

  async consume(queueName: string, exchange: string, routingKey: string, onMessage: (msg: any) => Promise<void>) {
    if (!this.channel) throw new Error('Channel not initialized');
    
    await this.channel.assertExchange(exchange, 'topic', { durable: true });
    const q = await this.channel.assertQueue(queueName, { durable: true });
    await this.channel.bindQueue(q.queue, exchange, routingKey);

    this.channel.consume(q.queue, async (msg) => {
      if (msg) {
        try {
          const content = JSON.parse(msg.content.toString());
          await onMessage(content);
          this.channel?.ack(msg);
        } catch (err) {
          console.error('Failed to process message', err);
          this.channel?.nack(msg, false, false); // Do not requeue for now
        }
      }
    });
  }

  async close() {
    await this.channel?.close();
    await this.connection?.close();
  }
}
