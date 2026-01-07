# Telegram ChatGPT Bot - Project Structure

```
telegram-chatgpt-bot/
├── .env.example              # Example environment variables file
├── .env                       # Environment variables (not committed to git)
├── .gitignore                 # Git ignore file
├── package.json               # Node.js package configuration
├── README.md                  # Project documentation
├── index.js                   # Main bot implementation
├── prompts/
│   ├── system.txt             # System prompt for ChatGPT behavior
│   └── voice_handling.txt     # Special instructions for voice messages
└── test/
    └── setup.test.js          # Setup verification script
```

## File Descriptions

### Configuration Files
- **.env.example**: Template for environment variables
- **.env**: Actual environment variables (contains secrets, not committed to git)
- **.gitignore**: Specifies files and directories that should not be committed to git
- **package.json**: Project metadata and dependencies

### Documentation
- **README.md**: Comprehensive project documentation

### Source Code
- **index.js**: Main bot implementation that handles Telegram messages and OpenAI integration

### Prompts
- **prompts/system.txt**: Defines the bot's personality and behavior
- **prompts/voice_handling.txt**: Special instructions for handling voice messages

### Testing
- **test/setup.test.js**: Script to verify the setup is correct

## Environment Variables

The bot requires the following environment variables:
- `TELEGRAM_BOT_TOKEN`: Token obtained from @BotFather
- `OPENAI_API_KEY`: API key from OpenAI
- `BOT_NAME`: Optional name for the bot
- `DEBUG`: Optional debug flag

## Dependencies

- `dotenv`: For loading environment variables from .env file
- `node-telegram-bot-api`: For interacting with Telegram Bot API
- `openai`: For interacting with OpenAI API (ChatGPT and Whisper)
- `nodemon` (dev): For automatic restart during development