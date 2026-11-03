# 默认鲸鱼娘素材

## 0.6 内置角色动画

### 鲸鱼娘「深深」

文件：`src/assets/pets/shenshen/*.webm`（10 段原始透明动画）及从待机动画抽帧生成的 `poster.png`。下载文件未修改，尺寸与 Git blob 摘要记录在 `scripts/pet-assets-manifest.json`。海报仅用于静态预览，沿用动画素材许可。

素材来源：https://github.com/MerZlin/dsh-pet-indesktop/tree/main/assets/characters/shenshen/videos

原项目与素材来源：https://github.com/PC2005-cloud/dsh-pet

角色原型「溟月」：上善无形 https://space.bilibili.com/4456176 ；女仆鲸鱼娘设计：ZipZipPipe https://space.bilibili.com/4168597 ；动作素材由相关项目社区成员整理制作。

依据上游声明，角色形象与动画使用 CC BY-NC-SA 4.0（署名、非商业、相同方式共享）：https://creativecommons.org/licenses/by-nc-sa/4.0/ 。仅用于个人非商业版本，不能将这些素材声明为 MIT 或用于商业发行。上游声明：https://github.com/MerZlin/dsh-pet-indesktop/blob/main/THIRD_PARTY_NOTICES.md 。没有引入上游程序、API Key、聊天、OCR 或系统采集依赖。

### 像素基础角色

文件：`src/assets/pets/fox/`、`rubber-duck/`、`crab/` 下的 GIF，以及从对应待机 GIF 转换得到的 PNG 静态预览。GIF 原始文件未修改，下载摘要同上述 manifest。

来源：https://github.com/tonybaloney/vscode-pets 。小狐狸美术作者 Elthen；小黄鸭、小螃蟹美术作者 Marc Duiker。署名来源：https://github.com/tonybaloney/vscode-pets#credits 。上游 MIT 许可全文随附于 `licenses/vscode-pets-MIT.txt`。

本贡献保留以上素材来源及许可声明，随本地应用打包。

## 静态预览与图标

`src/assets/whale-girl.png` 是上述鲸鱼娘待机预览图的中心裁切，`build-resources/desktop-assistant.ico` 及 PNG 是其尺寸与格式转换。三者均由同一套 CC BY-NC-SA 4.0 素材派生，保留相同署名及授权范围。没有使用 MeteorNOX 仓库中授权范围不明确的旧静态头像。

用户上传形象仅存本机用户数据目录，不随源码提交。
