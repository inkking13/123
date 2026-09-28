// Each hero's outfit, painted by Meshy Retexture onto their race body's own UVs
// (1K JPEG base colour). The body's model keeps its bare texture for monsters
// and anyone without an entry here.

export const HERO_SKINS: Record<number, number> = {
  0: require('../../assets/skins/hero-0.jpg'), // Каелен: бронзовые латы, тёмно-красная накидка
  1: require('../../assets/skins/hero-1.jpg'), // Борин: латы поверх кольчуги, рыжая борода
  2: require('../../assets/skins/hero-2.jpg'), // Фаэлар: оливковая мантия с капюшоном
  3: require('../../assets/skins/hero-3.jpg'), // Тэдиус: кожаный фартук, пояс с колбами
  // Векс (4) wears the modelled leather set instead (see BODIES.humanLeather).
  5: require('../../assets/skins/hero-5.jpg'), // Громмаш: ремни на голом торсе, меховая набедренная повязка
  6: require('../../assets/skins/hero-6.jpg'), // Сильвана: зелёная кожаная туника следопыта
  7: require('../../assets/skins/hero-7.jpg'), // Элара: тёмный корсет ведьмы
  8: require('../../assets/skins/hero-8.jpg'), // Родерик: серебряные латы, синяя накидка с золотом
  9: require('../../assets/skins/hero-9.jpg'), // Освальд: тяжёлые латы, меховая мантия
  10: require('../../assets/skins/hero-10.jpg'), // Ирма: белое одеяние с золотом
  11: require('../../assets/skins/hero-11.jpg'), // Джаспер: очки, кожаный фартук, колбы
  12: require('../../assets/skins/hero-12.jpg'), // Гаррет: меховой воротник, латы поверх кожи
  13: require('../../assets/skins/hero-13.jpg'), // Мортана: тёмно-красная кожаная броня
};
