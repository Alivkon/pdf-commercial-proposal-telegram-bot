const { handleOfferPdfFlow } = require('../src/offer.flow.handler');
const { createCommercialOffer, saveDialogToPDF } = require('../src/offer.pdf.generator');

// Мокаем зависимости
jest.mock('../pdfService', () => ({
  createCommercialOffer: jest.fn(),
  saveDialogToPDF: jest.fn()
}));

describe('handleOfferPdfFlow', () => {
  let mockBot;
  let chatId;
  let userId;
  let userText;
  let responseText;
  let offerData;
  let sourceLabel;

  beforeEach(() => {
    mockBot = {
      sendMessage: jest.fn(),
      sendDocument: jest.fn()
    };
    chatId = 123456789;
    userId = 'user123';
    userText = 'Запрос на коммерческое предложение';
    responseText = 'Вот ваше коммерческое предложение';
    offerData = null;
    sourceLabel = 'test';
    
    // Очищаем моки перед каждым тестом
    jest.clearAllMocks();
  });

  it('должен создать PDF коммерческого предложения, когда есть данные о продуктах', async () => {
    // Подготавливаем тестовые данные
    const mockOfferData = {
      products: [
        {
          name: "EDISON DC 30 кВт",
          connector: "GB/T (DC)",
          price_one: 650000,
          nds: 130000,
          quantity: 3,
          price_with_nds: 780000,
          specifications_file: "EDISON_DC_30.pdf"
        },
        {
          name: "EDISON DC 60 кВт",
          connector: "GB/T (DC)",
          price_one: 1500000,
          nds: 300000,
          quantity: 1,
          price_with_nds: 1800000,
          specifications_file: "EDISON_DC_60.pdf"
        }
      ],
      deliveryTime: "до 25 декабря 2025 г.",
      paymentTerms: "100% предоплата",
      person: "г.Москва",
      delivery: "За счет Поставщика",
      warranty: "Гарантийный срок – 2 года"
    };

    const mockPdfPath = '/path/to/commercial_offer.pdf';
    createCommercialOffer.mockResolvedValue(mockPdfPath);

    // Выполняем тестируемую функцию
    const result = await handleOfferPdfFlow({
      bot: mockBot,
      chatId,
      userId,
      userText,
      responseText,
      offerData: mockOfferData,
      sourceLabel
    });

    // Проверяем результаты
    expect(createCommercialOffer).toHaveBeenCalledWith(mockOfferData);
    expect(mockBot.sendDocument).toHaveBeenCalledWith(
      chatId,
      mockPdfPath,
      { caption: 'Коммерческое предложение' },
      { filename: 'commercial_offer.pdf', contentType: 'application/pdf' }
    );
    expect(result).toBe(mockPdfPath);
  });

  it('должен создать PDF диалога, когда нет данных о продуктах', async () => {
    const mockDialogPdfPath = '/path/to/dialog.pdf';
    saveDialogToPDF.mockResolvedValue(mockDialogPdfPath);

    const result = await handleOfferPdfFlow({
      bot: mockBot,
      chatId,
      userId,
      userText,
      responseText,
      offerData: {}, // Пустой объект без продуктов
      sourceLabel
    });

    expect(saveDialogToPDF).toHaveBeenCalledWith(
      userId,
      `[${sourceLabel}] ${userText}`,
      responseText
    );
    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      chatId,
      `📝 Диалог сохранён в PDF: ${mockDialogPdfPath}`
    );
    expect(mockBot.sendDocument).toHaveBeenCalledWith(
      chatId,
      mockDialogPdfPath,
      { caption: 'Диалог (PDF)' },
      { filename: 'dialog.pdf', contentType: 'application/pdf' }
    );
    expect(result).toBe(mockDialogPdfPath);
  });

  it('должен обработать ошибку при создании PDF коммерческого предложения', async () => {
    const mockOfferData = {
      products: [
        {
          name: "EDISON DC 30 кВт",
          socket: "GB/T (DC)",
          price_one: 650000,
          nds: 130000,
          quantity: 3,
          price_with_nds: 780000,
          specifications_file: "EDISON_DC_30.pdf"
        }
      ]
    };

    const errorMessage = 'Ошибка создания PDF';
    createCommercialOffer.mockRejectedValue(new Error(errorMessage));

    const result = await handleOfferPdfFlow({
      bot: mockBot,
      chatId,
      userId,
      userText,
      responseText,
      offerData: mockOfferData,
      sourceLabel
    });

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      chatId,
      `Ошибка при создании PDF коммерческого предложения: ${errorMessage}`
    );
    expect(result).toBeNull();
  });

  it('должен проверить валидацию продуктов перед созданием PDF', async () => {
    const invalidOfferData = {
      products: [
        {
          // Отсутствует обязательное поле name
          connector: "GB/T (DC)",
          price_one: 650000,
          nds: 130000,
          quantity: 3,
          price_with_nds: 780000
        }
      ]
    };

    const result = await handleOfferPdfFlow({
      bot: mockBot,
      chatId,
      userId,
      userText,
      responseText,
      offerData: invalidOfferData,
      sourceLabel
    });

    expect(mockBot.sendMessage).toHaveBeenCalledWith(
      chatId,
      expect.stringContaining('Невозможно сформировать коммерческое предложение, так как в items отсутствуют обязательные данные')
    );
    expect(createCommercialOffer).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });
});