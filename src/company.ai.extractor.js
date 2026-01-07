const OpenAI = require('openai');
require('dotenv').config();

// Инициализация OpenAI клиента
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Версия промпта для отслеживания изменений
const PROMPT_VERSION = '1.0.0';
const MODEL_VERSION = 'gpt-4o-mini';

/**
 * Промпт для извлечения данных о компании из текста
 */
const COMPANY_EXTRACTION_PROMPT = `Ты - эксперт по извлечению структурированных данных о компаниях из текстовых документов.

Проанализируй предоставленный текст и извлеки следующую информацию о компании:

1. name_full - полное наименование организации
2. name_short - краткое наименование (часто указывается в кавычках)
3. inn - ИНН (10 или 12 цифр)
4. kpp - КПП (9 цифр)
5. ogrn - ОГРН (13 или 15 цифр)
6. okpo - ОКПО
7. oktmo - ОКТМО
8. legal_address - юридический адрес
9. actual_address - фактический адрес (если указан отдельно)
10. email - массив email адресов
11. phone - массив телефонных номеров
12. ceo_name - ФИО руководителя/директора в дательном падеже (например, Оманову Сергею Владимировичу, Ахметшину Альберту Ренатовичу)

ВАЖНО:
- Если какое-то поле не найдено в тексте, верни null для этого поля
- Для массивов (email, phone) верни пустой массив [], если ничего не найдено
- ИНН, КПП, ОГРН должны быть строками и содержать только цифры
- Телефоны могут быть в любом формате, сохраняй их как есть
- Если указано несколько адресов, попробуй определить, какой юридический, а какой фактический

Верни результат СТРОГО в формате JSON без дополнительных пояснений:

{
  "name_full": "...",
  "name_short": "...",
  "inn": "...",
  "kpp": "...",
  "ogrn": "...",
  "okpo": "...",
  "oktmo": "...",
  "legal_address": "...",
  "actual_address": "...",
  "email": [...],
  "phone": [...],
  "ceo_name": "...",
  "confidence": {
    "inn": 0.95,
    "name": 0.90,
    "address": 0.85,
    "overall": 0.90
  }
}

В поле confidence укажи уверенность в извлечении данных (от 0 до 1):
- inn: уверенность в правильности ИНН
- name: уверенность в правильности названия
- address: уверенность в правильности адреса
- overall: общая уверенность в извлеченных данных

Текст документа:

`;

/**
 * Извлечение данных о компании из текста с помощью ChatGPT
 * @param {string} documentText - Текст документа
 * @param {object} options - Дополнительные опции
 * @returns {Promise<object>} Извлеченные данные о компании
 */
async function extractCompanyDataFromText(documentText, options = {}) {
  try {
    const {
      model = MODEL_VERSION,
      temperature = 0.1,
      maxTokens = 2000
    } = options;

    console.log(`Отправка запроса к ChatGPT (модель: ${model})...`);

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        {
          role: 'system',
          content: 'Ты - эксперт по извлечению структурированной информации о компаниях из документов. Всегда отвечай только валидным JSON без дополнительного текста.'
        },
        {
          role: 'user',
          content: COMPANY_EXTRACTION_PROMPT + documentText
        }
      ],
      temperature: temperature,
      max_tokens: maxTokens,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0].message.content;
    console.log(`✓ Получен ответ от ChatGPT (${response.usage.total_tokens} токенов)`);

    // Парсим JSON ответ
    const extractedData = JSON.parse(content);

    // Проверяем наличие обязательного поля ИНН
    if (!extractedData.inn) {
      console.warn('⚠ ИНН не найден в документе');
    }

    return {
      data: extractedData,
      metadata: {
        model: model,
        prompt_version: PROMPT_VERSION,
        tokens_used: response.usage.total_tokens,
        finish_reason: response.choices[0].finish_reason
      }
    };
  } catch (error) {
    console.error(`✗ Ошибка при обработке текста через ChatGPT: ${error.message}`);

    if (error.response) {
      console.error('Детали ошибки:', error.response.data);
    }

    throw error;
  }
}

/**
 * Валидация извлеченных данных о компании
 * @param {object} companyData - Данные компании
 * @returns {object} Результат валидации с предупреждениями
 */
function validateCompanyData(companyData) {
  const warnings = [];
  const errors = [];

  // Проверка ИНН
  if (!companyData.inn) {
    errors.push('ИНН обязателен для сохранения компании');
  } else if (!/^\d{10}$|^\d{12}$/.test(companyData.inn)) {
    warnings.push(`ИНН должен содержать 10 или 12 цифр, получено: ${companyData.inn}`);
  }

  // Проверка КПП
  if (companyData.kpp && !/^\d{9}$/.test(companyData.kpp)) {
    warnings.push(`КПП должен содержать 9 цифр, получено: ${companyData.kpp}`);
  }

  // Проверка ОГРН
  if (companyData.ogrn && !/^\d{13}$|^\d{15}$/.test(companyData.ogrn)) {
    warnings.push(`ОГРН должен содержать 13 или 15 цифр, получено: ${companyData.ogrn}`);
  }

  // Проверка наличия названия
  if (!companyData.name_full && !companyData.name_short) {
    warnings.push('Не указано ни полное, ни краткое название компании');
  }

  // Проверка email
  if (companyData.email && companyData.email.length > 0) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    companyData.email.forEach(email => {
      if (!emailRegex.test(email)) {
        warnings.push(`Некорректный формат email: ${email}`);
      }
    });
  }

  // Проверка confidence
  if (companyData.confidence && companyData.confidence.overall < 0.7) {
    warnings.push(`Низкая уверенность в извлеченных данных: ${companyData.confidence.overall}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Извлечение и валидация данных компании из текста
 * @param {string} documentText - Текст документа
 * @param {object} options - Опции
 * @returns {Promise<object>} Результат с данными и валидацией
 */
async function extractAndValidateCompanyData(documentText, options = {}) {
  const result = await extractCompanyDataFromText(documentText, options);
  const validation = validateCompanyData(result.data);

  if (validation.warnings.length > 0) {
    console.warn('⚠ Предупреждения валидации:');
    validation.warnings.forEach(w => console.warn(`  - ${w}`));
  }

  if (validation.errors.length > 0) {
    console.error('✗ Ошибки валидации:');
    validation.errors.forEach(e => console.error(`  - ${e}`));
  }

  return {
    ...result,
    validation
  };
}

module.exports = {
  extractCompanyDataFromText,
  validateCompanyData,
  extractAndValidateCompanyData,
  PROMPT_VERSION,
  MODEL_VERSION
};
