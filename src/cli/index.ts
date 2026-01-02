/**
 * ACIA CLI - Command Line Interface
 *
 * Entry point for interacting with the ACIA system.
 * Uses Jarvis as the universal agent for handling all requests.
 */

import * as readline from 'readline';
import * as path from 'path';
import * as fs from 'fs';
import { JarvisAgent } from '../agents/executive/jarvis-agent.js';
import { LLMClient, LLMProvider } from '../core/llm/client.js';
import { WikiService } from '../core/wiki/wiki-service.js';
import { createFileTools } from '../core/tools/file-tools.js';
import { createExecTools } from '../core/tools/exec-tools.js';

// Load environment variables manually (dotenv has issues with ESM + tsx)
function loadEnv(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const eqIndex = trimmed.indexOf('=');
        if (eqIndex > 0) {
          const key = trimmed.substring(0, eqIndex).trim();
          const value = trimmed.substring(eqIndex + 1).trim();
          process.env[key] = value;
        }
      }
    }
  }
}

loadEnv();

async function main(): Promise<void> {
  // Determine LLM provider (default to OpenAI)
  const provider = (process.env['LLM_PROVIDER'] ?? 'openai') as LLMProvider;

  // Get API key for selected provider
  const apiKey =
    provider === 'openai'
      ? process.env['OPENAI_API_KEY']
      : process.env['ANTHROPIC_API_KEY'];

  if (!apiKey) {
    const keyName = provider === 'openai' ? 'OPENAI_API_KEY' : 'ANTHROPIC_API_KEY';
    console.error(`Error: ${keyName} not set in .env file`);
    console.error('Please add your API key to the .env file');
    process.exit(1);
  }

  // Determine workspace (current directory or specified)
  const workspace = process.cwd();
  const wikiRoot = path.join(workspace, '.acia-wiki');

  // Determine model based on provider
  const model = provider === 'openai' ? 'gpt-5-mini' : 'claude-sonnet-4-20250514';

  // Initialize LLM client
  const llmClient = new LLMClient({
    provider,
    apiKey,
    model,
    maxTokens: 4096,
  });

  // Initialize wiki service
  let wikiService: WikiService | undefined;
  try {
    if (!fs.existsSync(wikiRoot)) {
      fs.mkdirSync(wikiRoot, { recursive: true });
    }
    wikiService = new WikiService({ wikiRoot });
    await wikiService.initialize();
  } catch {
    console.warn('Warning: Could not initialize wiki service');
  }

  // Create tools for the workspace
  const fileTools = createFileTools(workspace);
  const execTools = createExecTools(workspace, ['test', 'build', 'typecheck', 'lint', 'dev']);

  // Initialize Jarvis
  const jarvis = new JarvisAgent({
    llmClient,
    tools: [...fileTools, ...execTools],
    wikiService,
  });

  // Set up escalation handler
  jarvis.setHumanEscalationHandler((reason, _context) => {
    console.log('\n⚠️  HUMAN INPUT REQUIRED');
    console.log('─'.repeat(50));
    console.log(`Reason: ${reason}`);
    console.log('─'.repeat(50));
  });

  console.log('═'.repeat(60));
  console.log('  ACIA - Autonomous Company Intelligence Architecture');
  console.log('═'.repeat(60));
  console.log(`Provider: ${provider} (${model})`);
  console.log(`Workspace: ${workspace}`);
  console.log(`Wiki: ${wikiService ? wikiRoot : 'disabled'}`);
  console.log('');
  console.log('Commands:');
  console.log('  /status  - Show system status');
  console.log('  /clear   - Clear conversation');
  console.log('  /exit    - Exit');
  console.log('');
  console.log('Type your request and press Enter.');
  console.log('─'.repeat(60));
  console.log('');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let isClosing = false;

  rl.on('close', () => {
    if (!isClosing) {
      isClosing = true;
      console.log('\nGoodbye!');
      process.exit(0);
    }
  });

  const prompt = (): void => {
    if (isClosing) return;

    rl.question('You: ', async (input) => {
      if (isClosing) return;

      const trimmed = input.trim();

      // Handle commands
      if (trimmed.toLowerCase() === '/exit' || trimmed.toLowerCase() === 'exit') {
        isClosing = true;
        console.log('\nGoodbye!');
        rl.close();
        return;
      }

      if (trimmed.toLowerCase() === '/status') {
        const companies = jarvis.getCompanies();
        console.log('\n📊 System Status');
        console.log('─'.repeat(40));
        console.log(`Companies: ${companies.length}`);
        if (companies.length > 0) {
          companies.forEach((c) => {
            console.log(`  - ${c.name} (${c.status}): ${c.domain}`);
            const projects = c.ceo.getActiveProjects();
            if (projects.length > 0) {
              projects.forEach((p) => {
                console.log(`    └─ ${p.title} [${p.status}]`);
              });
            }
          });
        }
        const conversation = jarvis.getConversation();
        console.log(`Conversation: ${conversation.length} messages`);
        console.log('');
        prompt();
        return;
      }

      if (trimmed.toLowerCase() === '/clear') {
        jarvis.clearConversation();
        console.log('Conversation cleared.\n');
        prompt();
        return;
      }

      if (!trimmed) {
        prompt();
        return;
      }

      console.log('');
      console.log('🤖 Processing...');

      try {
        const startTime = Date.now();
        const result = await jarvis.processRequest(trimmed);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

        console.log('');
        if (result.success) {
          console.log('✅ Success');
        } else {
          console.log('❌ Failed');
        }

        if (result.newCompanyCreated) {
          console.log('🏢 New company created');
        }

        if (result.delegatedTo) {
          console.log(`📋 Delegated to: ${result.delegatedTo}`);
        }

        if (result.escalatedToHuman) {
          console.log(`⚠️  Escalated: ${result.humanEscalationReason}`);
        }

        console.log(`⏱️  ${elapsed}s`);
        console.log('');
        console.log('─'.repeat(40));
        console.log(result.response);
        console.log('─'.repeat(40));
        console.log('');
      } catch (error) {
        console.error('\n❌ Error:', error instanceof Error ? error.message : 'Unknown error');
        console.log('');
      }

      prompt();
    });
  };

  prompt();
}

main().catch(console.error);
