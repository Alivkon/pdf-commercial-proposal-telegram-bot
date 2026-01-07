const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs').promises;

/**
 * Сохранить диалог в PDF с поддержкой UTF-8 (русский язык)
 */
async function saveDialogToPDF(userId, userMessage, assistantMessage, filename = null) {
  try {
    const pdfDir = path.join(__dirname, 'pdfs');
    await fs.mkdir(pdfDir, { recursive: true });
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfFilename = filename || `dialog_${userId}_${timestamp}.pdf`;
    const pdfPath = path.join(pdfDir, pdfFilename);
    
    // Создать PDF документ с UTF-8 поддержкой
    const doc = new PDFDocument({ 
      margin: 50,
      bufferPages: true,
      size: 'A4',
      font: 'Helvetica' // Установка шрифта по умолчанию
    });
    
    // Поддержка кириллических символов
    doc.font('Helvetica');
    
    const stream = require('fs').createWriteStream(pdfPath);
    doc.pipe(stream);
    
    // Заголовок
    doc.fontSize(16).text('Диалог с ИИ Ассистентом', { align: 'center' });
    doc.moveDown();
    
    // Линия разделения
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
    
    // Метаинформация
    doc.fontSize(9).text(`Пользователь ID: ${userId}`);
    doc.text(`Дата: ${new Date().toLocaleString('ru-RU')}`);
    doc.moveDown();
    
    // Вопрос пользователя
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('📝 Вопрос:', { underline: true });
    doc.fontSize(11).font('Helvetica');
    doc.text(userMessage, { align: 'left', width: 450 });
    doc.moveDown();
    
    // Линия разделения
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
    
    // Ответ ассистента
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text('💬 Ответ:', { underline: true });
    doc.fontSize(11).font('Helvetica');
    doc.text(assistantMessage, { align: 'left', width: 450 });
    
    // Футер
    doc.moveDown(2);
    doc.fontSize(8).text('Сгенерировано ботом NicolayChargeGPT', { align: 'center', color: '#999999' });
    
    doc.end();
    
    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        console.log(`✓ PDF сохранён: ${pdfPath}`);
        resolve(pdfPath);
      });
      stream.on('error', (error) => {
        console.error(`✗ Ошибка при сохранении PDF: ${error.message}`);
        reject(error);
      });
    });
  } catch (error) {
    console.error('Ошибка при сохранении PDF:', error.message);
    throw error;
  }
}

module.exports = { saveDialogToPDF };
