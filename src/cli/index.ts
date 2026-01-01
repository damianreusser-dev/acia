/**
 * ACIA CLI - Command Line Interface
 *
 * Entry point for interacting with the ACIA system.
 * Phase 1: Simple REPL for chatting with a single agent.
 */

import * as readline from 'readline';
import { config } from 'dotenv';
import { Agent } from '../agents/base/agent.js';
import { LLMClient } from '../core/llm/client.js';

// Load environment variables
config();

const SYSTEM_PROMPT = `You are a helpful AI assistant that is part of the ACIA system.
You are currently in Phase 1 - a simple agent that can have conversations.
Be concise and helpful in your responses.`;

async function main(): Promise<void> {
  const apiKey = process.env['ANTHROPIC_API_KEY'];

  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY not set in .env file');
    console.error('Please add your API key to the .env file');
    process.exit(1);
  }

  const llmClient = new LLMClient({ apiKey });

  const agent = new Agent({
    name: 'Assistant',
    role: 'General Assistant',
    systemPrompt: SYSTEM_PROMPT,
    llmClient,
  });

  console.log('='.repeat(50));
  console.log('ACIA - Autonomous Company Intelligence Architecture');
  console.log('Phase 1a: Basic Agent Communication');
  console.log('='.repeat(50));
  console.log('Type your message and press Enter. Type "exit" to quit.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (): void => {
    rl.question('You: ', async (input) => {
      const trimmed = input.trim();

      if (trimmed.toLowerCase() === 'exit') {
        console.log('\nGoodbye!');
        rl.close();
        return;
      }

      if (!trimmed) {
        prompt();
        return;
      }

      try {
        const response = await agent.processMessage(trimmed);
        console.log(`\nAgent: ${response}\n`);
      } catch (error) {
        console.error('\nError:', error instanceof Error ? error.message : 'Unknown error');
      }

      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
