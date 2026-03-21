<!-- Generated: 2026-03-12 | Reviewer: CFO Agent (Claude Opus 4.6) | Status: review -->

# CFO Review: OSS-Core Launch Memo

Reviewed document: `oss-core-launch-memo-2026-03-22.md`
Date: 2026-03-12

---

## 1. Unit Economics пилота

**Прямые затраты (известные):**
- API/inference costs: до $500 (заложено в документе)
- Cloud infra (dev окружение, CI): ~$50-100

**Прямые затраты (не учтённые в документе):**
- **Founder time** -- главная неучтённая статья. 14-дневный pilot на 8-10 задач с onboarding, настройкой, коммуникацией, readout -- реалистично 40-60 часов founder time. При альтернативной стоимости $100-200/час (advisory ставка) это $4,000-12,000 opportunity cost.
- **Pre-sales cost**: outreach, discovery calls, подготовка SOW. На 10 контактов и 3 диалога для закрытия 1 pilot -- ещё 15-25 часов.
- **Scope creep support**: change requests зафиксированы на $1,000+, но реальность ранних пилотов -- клиент просит "ещё одну мелочь".

**Маржа:**

| Статья | Сумма |
|---|---|
| Revenue | $3,000 |
| API costs | -$500 |
| Infra | -$100 |
| **Cash margin** | **$2,400 (80%)** |
| Founder time (50 hrs x $150) | -$7,500 |
| **Экономическая маржа** | **-$5,100** |

**Вердикт:** Cash margin положительная. Экономическая маржа отрицательная, что нормально для первого pilot (инвестиция в product-market fit validation). Но документ должен это явно признавать.

**Рекомендация:** Добавить строку "founder opportunity cost" в финансовую модель. Не для отказа от pilot, а для понимания реальной цены validation.

---

## 2. Pricing

**$3,000 за paid pilot:** Для Казахстана средний/верхний диапазон для B2B consulting с SMB. Для раннего продукта без track record -- адекватно. Не снижать.

**$1,500 за GitLab integration: занижено.** Реальная интеграция (MR flow, hooks, API wiring) -- 15-25 часов работы. При ставке $100-200/час это $1,500-5,000 себестоимость. Продажа по себестоимости.

**Рекомендация:** Поднять GitLab add-on до $2,500-3,000 или $1,500 только как bundle discount при покупке с pilot, standalone -- $3,000.

**$100-200/час advisory:** Для РК премиальная ставка, но для AI/DevOps экспертизы рыночная. Проблема: при ставке $100/час и pilot за $3,000 клиент считает pilot = 30 часов. Не публиковать advisory rate рядом с pilot price.

---

## 3. Cash Flow

**70% upfront -- правильно.** Покрывает API costs с запасом.

**Не учтено:**

1. **Валютный риск.** Цены в USD, юрисдикция РК. Если клиент платит в тенге, курсовой разрыв может съесть маржу.

2. **Сроки поступления.** Казахстанские B2B могут платить 5-15 рабочих дней после подписания. Это съедает половину 14-дневного pilot. **Delivery starts after payment received, not after contract signed.**

3. **Tax cash flow.** Упрощённый режим для ИП -- 3% от оборота. ТОО на общеустановленном -- до 20% КПН.

4. **Нулевой буфер.** Нет упоминания runway: сколько месяцев founder может работать без revenue?

---

## 4. Трёхсценарная модель

**Optimistic ($7,500) -- нереалистичен.** 2 pilot + GitLab add-on за 14 дней -- founder единственный delivery resource, два параллельных pilot физически невозможны.

**Рекомендация:** Добавить **conservative** сценарий: $3,000 revenue, но delivery затянулся до 21 дня или scope creep добавил 20 часов бесплатной работы.

**Вероятности:**

| Сценарий | Моя оценка |
|---|---|
| Stress ($0) | 40-50% |
| Base ($3,000) | 35-40% |
| Conservative ($3,000, overrun) | 15-20% |
| Optimistic ($7,500) | 5-10% |

---

## 5. Финансовые KPI

| KPI | Оценка |
|---|---|
| 10 contacts | Реалистично |
| 3 qualified dialogs | Амбициозно (30% от cold -- выше рынка, типично 10-15%) |
| 1 signed pilot за 14 дней | Амбициозно (B2B от proposal до подписания обычно 7-14 дней) |

**Рекомендация:** Разделить: минимум 3-5 warm contacts через существующую сеть. Добавить leading indicator: "first discovery call by 2026-03-23".

---

## 6. Масштабирование (апрель)

При подтверждённом base сценарии, апрельский target:
- 2-3 pilot ($6,000-$9,000)
- 1-2 GitLab add-on ($3,000-$6,000 при revised pricing)
- Advisory ($500-$2,000)
- **Total April: $9,500-$17,000**

**Что нужно:**
1. Case study от первого pilot
2. Delivery capacity (part-time помощник при 2+ параллельных pilot)
3. SOW template для переиспользования
4. Referral mechanism (reference call от первого клиента)

---

## 7. Неучтённые финансовые риски

1. **Single point of failure -- founder.** Нет backup, нет SLA buffer.
2. **Tax structuring.** Не зафиксирован дедлайн решения ИП/ТОО до invoice.
3. **Cross-border payments.** SWIFT fees $25-50, конвертация при $3,000 -- 1-2% потерь.
4. **IP risk при pilot delivery.** Кто владеет кастомизациями для клиента?
5. **OSS community time.** Публикация = issues, вопросы, PR. Конкурирует за founder time с paid work. Нет policy.
6. **Non-payment 30%.** Юридическое взыскание $900 не стоит усилий. Рекомендация: 100% upfront или привязать readout report к финальному платежу.
7. **Reputational risk.** Первый публичный pilot = первый публичный отзыв. Нужен expectation management в SOW.

---

## Итоговая сводка

| Область | Оценка | Действие |
|---|---|---|
| Unit economics | Cash-positive, экономически убыточный (нормально для validation) | Учесть founder time |
| Pricing | Pilot ОК, GitLab занижен | Поднять GitLab до $2,500-3,000 |
| Cash flow | 70% upfront правильно | Start delivery после поступления |
| Сценарии | Stress/base реалистичны, optimistic нет | Добавить conservative |
| KPI | Амбициозны при cold outreach | Разделить warm/cold |
| Масштабирование | Возможно при case study + capacity | Part-time помощник с $9K+ monthly |
| Риски | Основные покрыты, пропущены 7 значимых | Tax structure и IP ownership до invoice |

**Главный вывод:** Это investment round в product validation за свой счёт, а не прибыльный бизнес с первого дня. Ожидаемый исход на 26 марта с вероятностью 50% -- stress или conservative. Нужен plan B: что делать 27 марта при revenue = $0.
