# 研习 166 · 设计元素 — 二级分类

> 目标页：[`/study/more/166`](https://lolitalibrary.com/study/more/166)  
> 对照数据：`docs/wiki.json`（type2 设计元素 / type17 设计分类）  
> 种子脚本：`scripts/seed-study-166-categories.mjs`

---

## 已落库分类（2026-08-07）

| # | 分类名 | study_id | sort | 对齐 wiki（type17） |
|---|--------|----------|------|---------------------|
| 1 | 领型 | 167 | 800 | #5349 领型 |
| 2 | 袖型 | 224 | 790 | #5350 袖型（含肩袖装饰） |
| 3 | 门襟 | 225 | 780 | #6410 门襟 / #6843 前襟门襟 |
| 4 | 腰线 | 226 | 770 | #6411 腰线裤头 |
| 5 | 裙身 | 227 | 760 | #6412 裙身 / #6441 衣身大身 |
| 6 | 裙摆 | 228 | 750 | #6413 裙摆 / #6442 衣摆裙摆 |
| 7 | 结构剪裁 | 229 | 740 | #6902 结构造型 / #6862 结构剪裁 |
| 8 | 装饰工艺 | 230 | 730 | #6849 褶皱工艺 / #6848 图案工艺 |

均为 `study_type=1`，`study_url=pages/study/studyMore?id=<id>`。

### 本轮约定

- 「肩袖装饰」并入 **袖型**
- 「门襟 / 前襟」显示名为 **门襟**
- 鞋 / 包 / 假发：已补建（见下）

### 配饰扩展（2026-08-07）

| # | 分类名 | study_id | sort | 已挂 | 对齐 wiki |
|---|--------|----------|------|------|-----------|
| 9 | 鞋类设计 | 546 | 720 | 37 | #6805–6807、#6945 + type2 鞋履词条 |
| 10 | 包包 | 584 | 710 | 5 | #6904 + 口金/手提/斜挎/双肩 |
| 11 | 假发 | 590 | 700 | 10 | #6868 + 发型相关词条 |

脚本：`scripts/seed-study-166-accessories.mjs`

---

## 暂缓

| 分类 | 说明 |
|------|------|
| 时代 / 地区特征 | 与主要风格 103 交叉 |

---

## 边界

| 内容 | 归属 |
|------|------|
| 风格名 | 研习 103 |
| 名词口语 | 研习 107 |
| 设计部位词条 | **本研习 166** |

---

## 下级百科关联（2026-08-07）

> 脚本：`scripts/seed-study-166-wiki-links.mjs`  
> 来源：线上 `wiki/getOptions?type_id=2`（423）+ 部分 type17 节点  
> 本批新建 **315** 条（`study_type=2`）

| 分类 | study_id | 已挂条数 |
|------|----------|----------|
| [领型](https://lolitalibrary.com/study/more/167) | 167 | 86 |
| [袖型](https://lolitalibrary.com/study/more/224) | 224 | 54 |
| [门襟](https://lolitalibrary.com/study/more/225) | 225 | 21 |
| [腰线](https://lolitalibrary.com/study/more/226) | 226 | 13 |
| [裙身](https://lolitalibrary.com/study/more/227) | 227 | 21 |
| [裙摆](https://lolitalibrary.com/study/more/228) | 228 | 32 |
| [结构剪裁](https://lolitalibrary.com/study/more/229) | 229 | 22 |
| [装饰工艺](https://lolitalibrary.com/study/more/230) | 230 | 66 |
| [鞋类设计](https://lolitalibrary.com/study/more/546) | 546 | 37 |
| [包包](https://lolitalibrary.com/study/more/584) | 584 | 5 |
| [假发](https://lolitalibrary.com/study/more/590) | 590 | 10 |

鞋/包/假发已补挂。仍未挂：汉元素主题等难归类标签。若要补挂或改类，指出 wiki 名即可。
