const { createCommercialOffer, saveDialogToPDF } = require('./offer.pdf.generator');
const path = require('path');
const fs = require('fs');

// Validate required fields in offer products and return human-readable issues
function validateOfferProducts(products) {
  const issues = [];
  if (!Array.isArray(products) || products.length === 0) {
    issues.push('Отсутствует массив items/products');
    return issues;
  }
  products.forEach((p, idx) => {
    const missing = [];
    if (!p || typeof p !== 'object') {
      issues.push(`Позиция #${idx + 1}: невалидный объект товара`);
      return;
    }
    if (!p.name) missing.push('name');
    if (!p.connector || p.connector === '-') missing.push('connector');
    const priceNum = Number(p.price_one);
    if (!Number.isFinite(priceNum)) missing.push('price_one');
    const qtyNum = Number(p.quantity);
    if (!Number.isFinite(qtyNum) || Math.round(qtyNum) <= 0) missing.push('quantity');
    if (missing.length) {
      issues.push(`Позиция #${idx + 1}: отсутствуют поля: ${missing.join(', ')}`);
    }
  });
  return issues;
}

async function handleOfferPdfFlow({ bot, chatId, userId, userText, responseText, offerData, sourceLabel }) {
  if (offerData?.products?.length > 0) {
    const itemsCount = offerData.items_count || offerData.products.length;
    console.log(`Creating commercial offer PDF with ${itemsCount} items...`);

    // Validate products before PDF creation
    const validationIssues = validateOfferProducts(offerData.products);
    if (validationIssues.length) {
      const details = validationIssues.map(i => `- ${i}`).join('\n');
      await bot.sendMessage(
        chatId,
        `Невозможно сформировать коммерческое предложение, так как в items отсутствуют обязательные данные:\n${details}`
      );
      return null;
    }

    try {
      const filePath = await createCommercialOffer(offerData);
      try {
        const filename = path.basename(filePath);
        await bot.sendDocument(
          chatId,
          filePath,
          { caption: 'Коммерческое предложение' },
          { filename, contentType: 'application/pdf' }
        );
      } catch (sendErr) {
        console.warn('⚠ Не удалось отправить PDF-файл как документ:', sendErr.message);
      }
      return filePath;
    } catch (err) {
      // If PDF creation fails for any reason, inform the user with context
      const details = validationIssues.length
        ? `\nДетали по items:\n${validationIssues.map(i => `- ${i}`).join('\n')}`
        : '';
      await bot.sendMessage(
        chatId,
        `Ошибка при создании PDF коммерческого предложения: ${err.message}${details}`
      );
      return null;
    }
  } else {
    const prefix = sourceLabel ? `[${sourceLabel}] ` : '';
    const filePath = await saveDialogToPDF(userId, `${prefix}${userText}`, responseText);
    await bot.sendMessage(chatId, `📝 Диалог сохранён в PDF: ${filePath}`);
    try {
      const filename = path.basename(filePath);
      await bot.sendDocument(
        chatId,
        filePath,
        { caption: 'Диалог (PDF)' },
        { filename, contentType: 'application/pdf' }
      );
    } catch (sendErr) {
      console.warn('⚠ Не удалось отправить PDF-файл диалога как документ:', sendErr.message);
    }
    return filePath;
  }
}

module.exports = { handleOfferPdfFlow };
