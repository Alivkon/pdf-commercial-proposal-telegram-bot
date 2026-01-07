const path = require('path');
const fs = require('fs').promises;

/**
 * Форматирование числа как валюты
 * @param {number} amount - Сумма
 * @returns {string} Отформатированная сумма
 */
function formatCurrency(amount) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

/**
 * Получение названия месяца в родительном падеже
 * @param {number} monthIndex - Индекс месяца (0-11)
 * @returns {string} Название месяца в родительном падеже
 */
function getMonthNameGenitive(monthIndex) {
  const months = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
  ];
  return months[monthIndex];
}

/**
 * Группировка товаров по гарантийному сроку
 * @param {Array} products - Массив товаров
 * @returns {Object} Группированные товары
 */
function groupProductsByWarranty(products) {
  const groups = {};
  
  // Если у товара нет поля warranty, используем значение по умолчанию
  products.forEach(product => {
    const warranty = product.warranty || 'Гарантийный срок – 2 года';
    if (!groups[warranty]) {
      groups[warranty] = [];
    }
    groups[warranty].push(product);
  });
  
  return groups;
}

/**
 * Рендер таблицы товаров
 * @param {PDFDocument} doc - Экземпляр PDFKit
 * @param {Array} products - Массив товаров
 * @param {number} tableTop - Верхняя граница таблицы
 * @param {Array} x - Массив X-координат колонок
 * @param {Array} w - Массив ширин колонок
 * @param {number} rowHeight - Высота строки
 * @param {number} left - Левая граница
 * @param {number} colsCount - Количество колонок
 * @param {number} gap - Зазор между колонками
 * @param {number} pageW - Ширина страницы
 * @param {number} wOther - Ширина колонки
 * @returns {number} Нижняя граница таблицы
 */
function renderProductTable(doc, products, tableTop, x, w, rowHeight, left, colsCount, gap, pageW, wOther) {
  // Рендер заголовков
  doc.font('GothamPro-Bold').text('Наименование', x[0], tableTop, { width: w[0], align: 'center' });
  doc.font('GothamPro-Bold').text('Разъем', x[1], tableTop, { width: w[1], align: 'center' });
  doc.font('GothamPro-Bold').text('Цена за шт., руб.', x[2], tableTop - 8, { width: w[2], align: 'center' });
  doc.font('GothamPro-Bold').text('НДС, руб.', x[3], tableTop, { width: w[3], align: 'center' });
  doc.font('GothamPro-Bold').text('Кол-во', x[4], tableTop, { width: w[4], align: 'center' });
  doc.font('GothamPro-Bold').text('Стоимость, руб. (c НДС)', x[5], tableTop - 8, { width: w[5] + 15, align: 'center' });

  // Линия под заголовками
  doc.moveTo(50, tableTop + rowHeight + 4).lineTo(550, tableTop + rowHeight + 4).lineWidth(0.1).stroke();

  // Рисуем вертикальные линии для заголовков
  let currentX = 50;
  doc.moveTo(currentX, tableTop - 10).lineTo(currentX, tableTop + rowHeight).lineWidth(0.1).stroke();
  for (let i = 0; i < colsCount - 1; i++) {
    currentX += w[i];
    doc.moveTo(currentX, tableTop - 10).lineTo(currentX, tableTop + rowHeight).lineWidth(0.1).stroke();
  }

  // Данные таблицы
  doc.font('GothamPro').fontSize(9);
  let currentY = tableTop + rowHeight + 10;
  let totalAmount = 0;
  let totalVAT = 0;
  let rowCount = 0;

  // === Данные ===
  for (const product of products) {
    const price = parseFloat(product.price_one) || parseFloat(product.price) || 0;
    const vat = parseFloat(product.nds) || parseFloat(product.vat) || 0;
    const quantity = parseInt(product.quantity) || 1;
    const total = parseFloat(product.price_with_nds);
    const lineTotal = (Number.isFinite(total) ? total : 0) * quantity;
    const displayName = (product.name || '').substring(0, 60);

    // Ячейки строки
    doc.font('GothamPro-Bold').text(displayName, x[0] + 5, currentY, { width: w[0], align: 'left' });
    doc.font('GothamPro').text(product.socket || product.connector || '-', x[1], currentY - 3, { width: w[1], align: 'center' });
    doc.font('GothamPro').text(formatCurrency(price), x[2], currentY, { width: w[2], align: 'center' });
    doc.font('GothamPro').text(formatCurrency(vat), x[3], currentY, { width: w[3], align: 'center' });
    doc.font('GothamPro').text(String(quantity), x[4], currentY, { width: w[4], align: 'center' });
    doc.font('GothamPro').text(formatCurrency(lineTotal), x[5] - 5, currentY, { width: w[5] + 15, align: 'center' });

    // Рисуем вертикальные линии для строки
    let rowX = left;
    doc.moveTo(rowX, currentY - 10).lineTo(rowX, currentY + rowHeight - 5).lineWidth(0.1).stroke();
    for (let i = 0; i < colsCount - 1; i++) {
      rowX += w[i];
      doc.moveTo(rowX, currentY - 10).lineTo(rowX, currentY + rowHeight - 5).lineWidth(0.1).stroke();
    }

    // Рисуем горизонтальную линию под строкой
    doc.moveTo(left, currentY + rowHeight - 5).lineTo(550, currentY + rowHeight - 5).lineWidth(0.1).stroke();

    totalAmount += lineTotal;
    totalVAT += vat * quantity;
    currentY += rowHeight;
    rowCount++;
  }

  currentY += 10;
  // Итого
  doc.font('GothamPro-Bold').text('Итого: ', 315, currentY - 10, { align: 'center' });
  doc.font('GothamPro-Bold').text(formatCurrency(totalAmount), x[5] - 15, currentY - 10, { align: 'center' });
  doc.moveTo(pageW - wOther + 19.7, currentY - 15).lineTo(pageW - wOther + 19.7, currentY + 5).lineWidth(0.1).stroke();
  doc.moveTo(left, currentY + 5).lineTo(550, currentY + 5).lineWidth(0.1).stroke();
  currentY += rowHeight;

  // НДС
  doc.font('GothamPro-Bold').text('НДС:', 315, currentY - 10, { align: 'center' });
  doc.font('GothamPro').text(formatCurrency(totalVAT), x[5] - 15, currentY - 10, { align: 'center' });
  doc.moveTo(pageW - wOther + 19.7, currentY - 15).lineTo(pageW - wOther + 19.7, currentY + 5).lineWidth(0.1).stroke();

  currentY += rowHeight;

  rowCount++;
  // Рисуем внешнюю рамку таблицы
  doc.rect(left, tableTop - 10, 500, rowHeight + 15 + (rowCount + 1) * rowHeight).lineWidth(0.1).stroke();

  return currentY;
}

function renderConditionsTable(doc, offerData, warrantyValue, currentY, left, pageW, rowHeight, firstColumnWidth) {
  doc.fontSize(10);

  const conditionsStartY = currentY;
  let conditionsRowCount = 0;

  const labelWidth = firstColumnWidth;
  const labelX = left + 5;
  const valueX = left + labelWidth + 15;
  const valueWidth = pageW - labelWidth - 15;

  if (offerData.deliveryTime) {
    doc.font('GothamPro-Bold').text('Срок поставки:', labelX, currentY);
    doc.font('GothamPro').text(offerData.deliveryTime, valueX, currentY, { width: valueWidth });
    currentY += rowHeight;
    conditionsRowCount++;
  }

  if (offerData.paymentTerms) {
    doc.font('GothamPro-Bold').text('Условия оплаты:', labelX, currentY);
    doc.font('GothamPro').text(offerData.paymentTerms, valueX, currentY, { width: valueWidth });
    currentY += rowHeight;
    conditionsRowCount++;
  }

  if (offerData.delivery) {
    doc.font('GothamPro-Bold').text('Доставка:', labelX, currentY);
    doc.font('GothamPro').text(offerData.delivery, valueX, currentY, { width: valueWidth });
    currentY += rowHeight;
    conditionsRowCount++;
  }

  doc.font('GothamPro-Bold').text('Гарантия:', labelX, currentY);
  doc.font('GothamPro').text(`${warrantyValue} Срок службы изделия – 10 лет.`, valueX, currentY, { width: valueWidth });
  currentY += rowHeight;
  conditionsRowCount++;

  if (conditionsRowCount > 0) {
    const boxHeight = conditionsRowCount * rowHeight;
    doc.rect(left, conditionsStartY - 5, pageW + 5, boxHeight).lineWidth(0.1).stroke();

    for (let i = 1; i < conditionsRowCount; i++) {
      const lineY = conditionsStartY + i * rowHeight;
      doc.moveTo(left, lineY - 5).lineTo(left + pageW + 5, lineY - 5).lineWidth(0.1).stroke();
    }

    doc.moveTo(left + labelWidth + 10, conditionsStartY - 5).lineTo(left + labelWidth + 10, conditionsStartY + boxHeight - 5).lineWidth(0.1).stroke();
  }

  return currentY;
}

/**
 * Рендер листа коммерческого предложения
 * @param {PDFDocument} doc - Экземпляр PDFKit
 * @param {object} offerData - Данные для предложения из LLM
 */
async function renderCommercialOfferSheet(doc, offerData) {
  let backgroundImage = null;
  let backgroundImageSize = null;
  const backgroundImagePath = path.join(__dirname, 'img', 'background.png');
  try {
    await fs.access(backgroundImagePath);
    backgroundImage = doc.openImage(backgroundImagePath);
    backgroundImageSize = { width: backgroundImage.width, height: backgroundImage.height };
  } catch (e) {
    console.warn('⚠ Изображение background.png не найдено');
  }

  let headImage = null;
  const headImagePath = path.join(__dirname, 'img', 'head.png');
  try {
    await fs.access(headImagePath);
    headImage = doc.openImage(headImagePath);
  } catch (imageError) {
    console.warn('⚠ Изображение head.png не найдено, продолжаем без него');
  }

  const drawPageDecorations = () => {
    if (headImage) {
      const pageWidth = doc.page.width;
      doc.image(headImage, 0, 0, {
        width: pageWidth,
        align: 'center'
      });
      doc.moveDown(8);
    }

    if (backgroundImage && backgroundImageSize) {
      const pageWidth = doc.page.width;
      const pageHeight = doc.page.height;
      const x = pageWidth - backgroundImageSize.width + 150;
      const y = pageHeight - backgroundImageSize.height + 75;
      doc.image(backgroundImage, x, y, { width: backgroundImageSize.width - 150 });
    }
  };

  drawPageDecorations();
  doc.on('pageAdded', drawPageDecorations);

  // Двухколоночный блок по ширине страницы
  const pageWidth =
    doc.page.width - doc.page.margins.left - doc.page.margins.right;

  const colLeftWidth = pageWidth / 2;
  const colRightWidth = pageWidth / 2;

  const startX = doc.page.margins.left;
  let y = doc.y+10;

  // ЛЕВЫЙ СТОЛБЕЦ
  // Форматируем текущую дату в формате «18» ноября 2025 г.
  const now = new Date();
  const day = now.getDate();
  const month = getMonthNameGenitive(now.getMonth());
  const year = now.getFullYear();
  const formattedDate = `«${day}» ${month} ${year}`;

  // Определяем тип получателя: физическое лицо или организация
  const userText = offerData.userText || '';
  const isIndividual = /(физику|для\s+физика)/i.test(userText);
  const clientCompany = offerData.clientCompany || {};
  const hasCompanyData = clientCompany.inn || clientCompany.name_short || clientCompany.name_full;

  // Если есть данные организации, показываем "г. Москва" в левом столбце
  if (hasCompanyData) {
    doc
      .font('GothamPro')
      .fontSize(11)
      .text(
        formattedDate,
        startX,
        y,
        {
          width: colLeftWidth,
          align: 'left'
        }
      );

    const moscowY = doc.y + 5;
    doc
      .font('GothamPro')
      .fontSize(10)
      .text(
        'г. Москва',
        startX,
        moscowY,
        {
          width: colLeftWidth,
          align: 'left'
        }
      );
  } else {
    // Только дата в левом столбце
    doc
      .fontSize(11)
      .text(
        formattedDate,
        startX,
        y,
        {
          width: colLeftWidth,
          align: 'left'
        }
      );
  }

  // ПРАВЫЙ СТОЛБЕЦ
  const rightX = startX + colLeftWidth;
  let clientY = y;

  if (isIndividual || !hasCompanyData) {
    // Для физического лица или если нет данных компании - только "г. Москва"
    doc.font('GothamPro').fontSize(10).text('г. Москва', rightX, clientY, { width: colRightWidth, align: 'right' });
  } else {
    // Для организации - полные реквизиты
    const companyName = clientCompany.name_short || clientCompany.name_full || ' ';
    const companyInn = clientCompany.inn || ' ';
    const companyKpp = clientCompany.kpp || ' ';
    const ceoDative = clientCompany.ceo_name_dative || clientCompany.ceo_name || '';

    doc.font('GothamPro-Bold').fontSize(10).text(companyName, rightX, clientY, { width: colRightWidth, align: 'right' });
    clientY = doc.y + 3;

    doc.font('GothamPro').fontSize(10).text(`ИНН ${companyInn}`, rightX, clientY, { width: colRightWidth, align: 'right' });
    clientY = doc.y + 3;

    doc.font('GothamPro').fontSize(10).text(`КПП ${companyKpp}`, rightX, clientY, { width: colRightWidth, align: 'right' });
    clientY = doc.y + 10;

    doc.font('GothamPro-Bold').fontSize(10).text('Генеральному директору', rightX, clientY, { width: colRightWidth, align: 'right' });
    clientY = doc.y + 3;

    doc.font('GothamPro').fontSize(10).text(ceoDative, rightX, clientY, { width: colRightWidth, align: 'right' });
  }

  // Отступ после таблицы
  doc.moveDown(5);
  const rowHeight = 20;
  // Заголовок
  doc.text('', 100, doc.y, { align: 'right' });
  doc.font('GothamPro-Bold').fontSize(11).text('КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ', { align: 'center' });
  doc.moveDown(0.1);
  doc.font('GothamPro-Bold').fontSize(10).text('на поставку электрических зарядных станций EDISON', { align: 'center' });
  doc.moveDown(2);

  // Таблица продуктов
  const tableTop = doc.y+5;

  // Заголовки таблицы
  doc.fontSize(10);

  const left = doc.page.margins.left;
  const right = doc.page.margins.right;
  const pageW = doc.page.width - left - right;

  const colsCount = 6;
  const gap = 2; // зазор между колонками (можно 0)

  // 1) ширина под 25 символов (используем "среднюю" ширину символов для кириллицы)
  let w1 = 140; // фиксированная ширина для первого столбца

  // 2) оставшаяся ширина делится поровну на 5 колонок
  const remaining = pageW - w1 - gap * (colsCount - 1);
  const wOther = Math.floor(remaining / 5);

  // 3) ширины колонок
  const w = [w1, wOther - 15, wOther + 10, wOther + 5, wOther - 20, remaining - wOther * 4]; // последняя добирает остаток

  // 4) X-позиции колонок
  const x = [left];
  for (let i = 1; i < colsCount; i++) x[i] = x[i - 1] + w[i - 1] + gap;
  x[4] -= 10; // сдвиг для колонки "Кол-во"

  // Группируем товары по гарантийному сроку
  const warrantyGroups = groupProductsByWarranty(offerData.products || []);
  let currentY = tableTop + rowHeight + 10;

  // Рендерим таблицы для каждой группы товаров
  const warrantyKeys = Object.keys(warrantyGroups);
  for (let i = 0; i < warrantyKeys.length; i++) {
    const warranty = warrantyKeys[i];
    const products = warrantyGroups[warranty];

    // Если это не первая таблица, добавляем отступ
    if (i > 0) {
      currentY += 20;
    }

    // Рендерим таблицу товаров
    currentY = renderProductTable(doc, products, currentY, x, w, rowHeight, left, colsCount, gap, pageW, wOther);
    const warrantyValue = warranty || offerData.warranty || 'Гарантийный срок – 2 года';
    currentY = renderConditionsTable(doc, offerData, warrantyValue, currentY - 10, left, pageW, rowHeight, w[0]);
    if (i < warrantyKeys.length - 1) {
      currentY += 15;
    }
  }

  const signatureBlockHeight = 190;
  const pageBottom = doc.page.height - doc.page.margins.bottom;
  if (currentY + signatureBlockHeight > pageBottom) {
    doc.addPage();
    currentY = doc.y;
  }

  // Подпись
  try {
    const signImagePath = path.join(__dirname, 'img', 'sign.png');
    await fs.access(signImagePath);
    doc.image(signImagePath, 300, currentY + 40, { width: 80 });
  } catch (e) {
    console.warn('⚠ Изображение sign.png не найдено');
  }
  // Печать
  try {
    const stampImagePath = path.join(__dirname, 'img', 'stamp.png');
    await fs.access(stampImagePath);
    doc.image(stampImagePath, 240, currentY + 30, { width: 120 });
  } catch (e) {
    console.warn('⚠ Изображение stamp.png не найдено');
  }
  // Двухколоночный блок по ширине страницы
  // ЛЕВЫЙ СТОЛБЕЦ
  doc
    .fontSize(11)
    .font('GothamPro')
    .text(
      'Генеральный директор\nООО «ЭЛТЕР»',
      startX,
      currentY + 60,
      {
        width: colLeftWidth,
        align: 'left'
      }
    );

  // ПРАВЫЙ СТОЛБЕЦ
  doc
    .fontSize(11)
    .font('GothamPro')
    .text(
      'М.М. Крапивной',
      startX + colLeftWidth,
      currentY + 60,
      {
        width: colRightWidth,
        align: 'right'
      }
    );

}

module.exports = {
  renderCommercialOfferSheet
};
