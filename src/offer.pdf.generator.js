const PDFDocument = require('pdfkit');
const { PDFDocument: PDFLibDocument } = require('pdf-lib');
const path = require('path');
const fs = require('fs').promises;
const { renderCommercialOfferSheet } = require('./offer.sheet.renderer');

// Register fonts supporting Cyrillic (GothamPro and GothamPro-Bold)
function registerCyrillicFonts(doc) {
  const regular = path.join(__dirname, 'fonts', 'GothamPro.ttf');
  const bold = path.join(__dirname, 'fonts', 'GothamPro-Bold.ttf');
  try {
    doc.registerFont('GothamPro', regular);
    doc.registerFont('GothamPro-Bold', bold);

    // set default
    doc.font('GothamPro');
    return true;
  } catch (e) {
    console.warn(
      '⚠ Не удалось зарегистрировать шрифты GothamPro и GothamPro-Bold. Использую Helvetica fallback.',
      {
        regularPath: regular,
        boldPath: bold,
        error: e?.message || e
      }
    );
    try {
      doc.font('Helvetica');
    } catch {}
    return false;
  }
}

/**
 * Создать коммерческое предложение в PDF из данных LLM
 * @param {object} offerData - Данные для предложения из LLM
 * @param {string} filename - Имя файла (опционально)
 * @returns {Promise<string>} Путь к сохранённому PDF файлу
 */
async function createCommercialOffer(offerData, filename = null) {
  try {
    const pdfDir = path.join(__dirname, 'pdfs');
    // Создаем директорию если она не существует
    await fs.mkdir(pdfDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfFilename = filename || `commercial_offer_${timestamp}.pdf`;
    const pdfPath = path.join(pdfDir, pdfFilename);

    const doc = new PDFDocument({
      margin: 50,
      bufferPages: true,
      size: 'A4'
    });

    registerCyrillicFonts(doc);

    // Создаем поток для записи файла
    const writeStream = require('fs').createWriteStream(pdfPath);
    doc.pipe(writeStream);

    await renderCommercialOfferSheet(doc, offerData);

    // Добавляем лист с описанием из файла спецификации, если указан
    const specFiles = [];
    if (offerData.specifications_file) {
      specFiles.push(offerData.specifications_file);
    }
    if (Array.isArray(offerData.products)) {
      for (const product of offerData.products) {
        if (product?.specifications_file) {
          specFiles.push(product.specifications_file);
        }
      }
    }
    const uniqueSpecFiles = Array.from(new Set(specFiles));
    if (uniqueSpecFiles.length) {
      console.log(`Указаны файлы спецификаций: ${uniqueSpecFiles.join(', ')}`);
    } else {
      console.log('Файлы спецификаций не указаны');
    }
    for (const specFile of uniqueSpecFiles) {
      const specFilePath = path.join(__dirname, 'specifications', specFile);
      try {
        await fs.access(specFilePath);
        console.log(`Файл спецификации найден: ${specFilePath}`);
      } catch (err) {
        console.warn(`⚠ Файл спецификации ${specFile} не найден в папке specifications`);
      }
    }

    // Завершаем документ
    doc.end();

    // Возвращаем путь к файлу после завершения записи
    return new Promise((resolve, reject) => {
      writeStream.on('finish', async () => {
        try {
          if (uniqueSpecFiles.length) {
            const basePdfBytes = await fs.readFile(pdfPath);
            const basePdfDoc = await PDFLibDocument.load(basePdfBytes);
            for (const specFile of uniqueSpecFiles) {
              const specFilePath = path.join(__dirname, 'specifications', specFile);
              try {
                const specPdfBytes = await fs.readFile(specFilePath);
                const specPdfDoc = await PDFLibDocument.load(specPdfBytes);
                const specPages = await basePdfDoc.copyPages(
                  specPdfDoc,
                  specPdfDoc.getPageIndices()
                );
                for (const page of specPages) {
                  basePdfDoc.addPage(page);
                }
              } catch (err) {
                console.warn(`⚠ Не удалось добавить спецификацию ${specFile}: ${err.message}`);
              }
            }
            const mergedBytes = await basePdfDoc.save();
            await fs.writeFile(pdfPath, mergedBytes);
          }
          console.log(`✓ Коммерческое предложение сохранено: ${pdfPath}`);
          resolve(pdfPath);
        } catch (error) {
          console.error(`✗ Ошибка при склейке PDF: ${error.message}`);
          reject(error);
        }
      });
      writeStream.on('error', (error) => {
        console.error(`✗ Ошибка при сохранении PDF: ${error.message}`);
        reject(error);
      });
    });
  } catch (error) {
    console.error('Ошибка при создании коммерческого предложения:', error.message);
    throw error;
  }
}

/**
 * Сохранить диалог (вопрос/ответ) в PDF с поддержкой кириллицы
 */
async function saveDialogToPDF(userId, userMessage, assistantMessage, filename = null) {
  const pdfDir = path.join(__dirname, 'pdfs');
  await fs.mkdir(pdfDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const pdfFilename = filename || `dialog_${userId}_${timestamp}.pdf`;
  const pdfPath = path.join(pdfDir, pdfFilename);

  const doc = new PDFDocument({
    margin: 50,
    bufferPages: true,
    size: 'A4'
  });

  const fontsOk = registerCyrillicFonts(doc);

  // Diagnostic text about font selection
  try {
    doc.fontSize(8).text(`Diagnostic: font=${fontsOk ? 'GothamPro' : 'Helvetica-fallback'}`);
    doc.moveDown(0.5);
  } catch {}

  const stream = require('fs').createWriteStream(pdfPath);
  doc.pipe(stream);

  // Заголовок
  doc.font('GothamPro-Bold').fontSize(16).text('Диалог с ИИ Ассистентом', { align: 'center' });
  doc.moveDown();

  // Линия разделения
  doc.moveTo(50, doc.y).lineTo(550, doc.y).lineWidth(0.1).stroke();
  doc.moveDown();

  // Метаинформация
  doc.font('GothamPro').fontSize(9).text(`Пользователь ID: ${userId}`);
  doc.text(`Дата: ${new Date().toLocaleString('ru-RU')}`);
  doc.moveDown();

  // Вопрос пользователя
  doc.font('GothamPro-Bold').fontSize(12).text('Вопрос:', { underline: true });
  doc.font('GothamPro').fontSize(11).text(userMessage || '', { align: 'left', width: 450 });
  doc.moveDown();

  // Линия разделения
  doc.moveTo(50, doc.y).lineTo(550, doc.y).lineWidth(0.1).stroke();
  doc.moveDown();

  // Ответ ассистента
  doc.font('GothamPro-Bold').fontSize(12).text('Ответ:', { underline: true });
  doc.font('GothamPro').fontSize(11).text(assistantMessage || '', { align: 'left', width: 450 });

  // Футер
  doc.moveDown(2);
  doc.font('GothamPro').fontSize(8).text('Сгенерировано ботом NicolayChargeGPT', { align: 'center' });

  doc.end();

  return new Promise((resolve, reject) => {
    const onSuccess = () => {
      console.log(`✓ PDF сохранён: ${pdfPath}`);
      resolve(pdfPath);
    };
    stream.on('finish', onSuccess);
    stream.on('close', onSuccess);
    stream.on('error', (error) => {
      console.error(`✗ Ошибка при сохранении PDF: ${error.message}`);
      reject(error);
    });
  });
}

module.exports = {
  createCommercialOffer,
  saveDialogToPDF
};
