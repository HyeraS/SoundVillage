// Legacy scalar-currency compatibility only. Economy v1 never imports this file.
// Discounts and daily deals are intentionally absent.
export const LEGACY_INTERIOR_PRICES = Object.freeze({
  wp_hearts:280, wp_clover:280, wp_bunny:340, wp_stripe:220, wp_night:420,
  fl_green:240, fl_rose:240, fl_brown:200, fl_stone:300,
  rug_persian_red:320, rug_persian_green:320, rug_circle_teal:260,
  bed_cream:520, bed_teal:560, dresser:410, wardrobe_teal:380,
  wardrobe_purple:380, fireplace:640, sofa_cream:340, sofa_red:340,
  armchair_cream:210, chair_cream:230, table_round:180, stool_wood:260,
  plant_tall:120, plant_bush:120, pot_cactus:150, books:140, fruitbowl:160,
  lamp_floor:290, candle:270, xmas_tree:480, curtain_red:260,
  curtain_green:260, curtain_blue:260, frame_butterfly2:190,
  cat:360, hamster:340, deer:520, cactus:300,
})

export const LEGACY_INTERIOR_SETS = Object.freeze([
  { id:'set_clover', name:'토끼풀 하우스', description:'클로버 벽지와 초록 타일, 자수 러그와 아기 사슴까지.', price:1180, bundleItemIds:['wp_clover','fl_green','rug_persian_green','deer'], tag:'인기' },
  { id:'set_night', name:'별밤 다락방', description:'별밤 벽지에 돌 바닥, 촛대와 낮잠 고양이를 얹었어요.', price:1290, bundleItemIds:['wp_night','fl_stone','candle','cat'], tag:'신규' },
  { id:'set_heart', name:'하트 룸', description:'하트 벽지와 로즈 타일, 둥근 러그와 햄찌 세트.', price:1080, bundleItemIds:['wp_hearts','fl_rose','rug_circle_teal','hamster'], tag:'한정' },
])
