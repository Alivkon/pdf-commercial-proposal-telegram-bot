# Telegram ChatGPT Bot

A Telegram bot that integrates with OpenAI's ChatGPT API to provide intelligent responses to text and voice messages.

## Features

- Responds to text messages with intelligent replies from ChatGPT
- Transcribes voice messages using OpenAI's Whisper API
- Maintains conversation history for context-aware responses
- Configurable through environment variables
- Customizable system prompts

## Prerequisites

- Node.js (v14 or higher)
- Telegram Bot Token (obtained from [@BotFather](https://t.me/BotFather))
- OpenAI API Key (obtained from [OpenAI](https://platform.openai.com/))
- Docker (for running Postgres locally or on a server)

## Setup

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd telegram-chatgpt-bot
   ```

2. Install dependencies using either npm or yarn:
   
   Using npm:
   ```bash
   npm install
   ```
   
   Using yarn:
   ```bash
   yarn install
   ```

3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```

4. Edit the `.env` file and add your:
   - Telegram Bot Token
   - OpenAI API Key
   - Postgres connection settings (see the Postgres section below)

5. Customize the system prompt in `prompts/system.txt` if desired.

## Usage

Start the bot using either npm or yarn:

Using npm:
```bash
npm start
```

Using yarn:
```bash
yarn start
```

For development with auto-restart:

Using npm:
```bash
npm run dev
```

Using yarn:
```bash
yarn dev
```

## Postgres (Docker)

This project includes a Docker Compose configuration for running Postgres locally or on a server.

1. Ensure the Postgres variables exist in `.env` (see `.env.example`):
   - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `POSTGRES_PORT`
   - `DATABASE_URL` for app usage

2. Start the database container:
   ```bash
   docker compose up -d
   ```

3. Verify the container is healthy:
   ```bash
   docker compose ps
   ```

The database data is persisted in a Docker volume (`postgres_data`). For production, keep the same `.env` and `docker-compose.yml` in the repo, and deploy by pulling from GitHub on the server and running `docker compose up -d`.

## Dev DB access

Use one of the following options to connect during development.

Option A: connect via Docker container
```bash
docker compose up -d
docker exec -it elter_postgres psql -U $POSTGRES_USER -d $POSTGRES_DB
```

Option B: connect via local client
- Use `DATABASE_URL` from `.env`, for example:
  `postgresql://elter:elterpass@localhost:5432/elter_db`
- Or connect using host `localhost`, port `5432`, and `POSTGRES_USER`/`POSTGRES_PASSWORD` from `.env`.

If port 5432 is already in use, set `POSTGRES_PORT=5433` (or any free port) in `.env` and update `DATABASE_URL`, for example:
`postgresql://elter:elterpass@localhost:5433/elter_db`

Quick commands in `psql`:
```sql
\dt
SELECT * FROM company LIMIT 10;
SELECT * FROM company_document LIMIT 10;
```

## How It Works

1. The bot listens for messages in Telegram chats where it's added
2. For text messages:
   - The message is sent to OpenAI's ChatGPT API
   - The response is sent back to the user
3. For voice messages:
   - The voice message is transcribed using OpenAI's Whisper API
   - The transcribed text is sent to ChatGPT
   - The response is sent back to the user

## Configuration

### Environment Variables

- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token from @BotFather
- `OPENAI_API_KEY`: Your OpenAI API key
- `BOT_NAME`: The name of your bot (optional)
- `DEBUG`: Set to "true" for debug mode (optional)

### Prompts

- `prompts/system.txt`: The system prompt that defines the bot's behavior
- `prompts/voice_handling.txt`: Special instructions for handling voice messages

## Conversation History

The bot maintains conversation history for each user to provide context-aware responses. The history is limited to 10 messages to prevent token overflow.

## Dependencies

- `dotenv`: For loading environment variables
- `node-telegram-bot-api`: For interacting with the Telegram Bot API
- `openai`: For interacting with the OpenAI API

## License

MIT
