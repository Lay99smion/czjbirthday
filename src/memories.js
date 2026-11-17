import { assetUrl } from './assets.js';

// 时光胶片按数字顺序播放 time1 → time14。
// caption：正面备注；backNote：点击照片翻面后的一句话，之后逐张填写即可，支持 \n 换行。
export const memories = [
  { src: "/time1.webp", alt: "时光回忆第 1 帧", caption: '终于18了，18岁生日快乐！', backNote: "祝小小的老子生日快乐！" },
  { src: "/time2.webp", alt: "时光回忆第 2 帧", caption: '谁还没有一个大虾梦', backNote: "没想到以前的你还这么幼稚！" },
  { src: "/time3.webp", alt: "时光回忆第 3 帧", caption: '卖个萌pa ✦', backNote: "你以为你是野原新之助吗？" },
  { src: "/time4.webp", alt: "时光回忆第 4 帧", caption: '就爱晚上溜达。 ♡', backNote: "偶尔出门散散步也挺好！" },
  { src: "/time5.webp", alt: "时光回忆第 5 帧", caption: '今晚住这里，冷呀。 ♡', backNote: "蒙古包耶，我都没住过，还得是你！" },
  { src: "/time6.webp", alt: "时光回忆第 6 帧", caption: '胖墩出门。 ✦', backNote: "这个时候的你可还不胖哦！" },
  { src: "/time7.webp", alt: "时光回忆第 7 帧", caption: '给你们搬个家。 ♡', backNote: "搬到我家吧！" },
  { src: "/time8.webp", alt: "时光回忆第 8 帧", caption: '秋风有一颗想出去玩的心。 ♡', backNote: "秋风亦有秋风愁，不劳秋风为我忧。秋风若有怜花意，可否许我再少年" },
  { src: "/time9.webp", alt: "时光回忆第 9 帧", caption: '中秋。 ✦', backNote: "希望下次中秋我也能收到一个毛绒挂件！" },
  { src: "/time10.webp", alt: "时光回忆第 10 帧", caption: '🥱 ♡', backNote: "羽毛球界的林丹" },
  { src: "/time11.webp", alt: "时光回忆第 11 帧", caption: '📶 ♡', backNote: "想当一次西部牛仔吗？" },
  { src: "/time12.webp", alt: "时光回忆第 12 帧", caption: '难吃的减脂餐。 ✦', backNote: "希望你能成功减重！✅" },
  { src: "/time13.webp", alt: "时光回忆第 13 帧", caption: '落日余晖。 ♡', backNote: "风景美，人也美。" },
  { src: "/time14.webp", alt: "时光回忆第 14 帧", caption: 'Go home。 ♡', backNote: "虽然我不是大连人，但是也替你感到高兴！"  },
].map(photo => ({ ...photo, originalSrc: photo.src, src: assetUrl(`/memories${photo.src}`) }));

// 月亮彩蛋相册保留原来的三张照片。
export const albumPhotos = [
  { src: "/pic1.webp", alt: "生日相册照片一", caption: "把这一刻，悄悄收藏。 ♡" },
  { src: "/pic2.webp", alt: "生日相册照片二", caption: "所有惊喜，都想与你分享。 ✦" },
  { src: "/pic3.webp", alt: "生日相册照片三", caption: "甜甜的愿望，正在实现。 ♡" },
].map(photo => ({ ...photo, src: assetUrl(photo.src) }));
