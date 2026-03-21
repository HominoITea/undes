<!-- Generated: 2026-03-12 | Version: v1.0 | Effective date: 2026-03-12 -->

# План первого OSS-релиза и коммерциализации

## 1. Метаданные документа
- Документ: внутренний strategic memo
- Проект: `ai-hub-coding`
- Владелец документа: Founder / Product Owner
- Ревьюер: external legal reviewer for RK + finance reviewer
- Утверждающий: Founder / CEO
- Язык: ru
- Юрисдикция по умолчанию: Республика Казахстан
- Первая публичная публикация: 2026-03-22
- Горизонт плана: 2026-03-12 to 2026-03-26
- Статус: working version for internal use

## 2. Цель и аудитория
- Цель: выпустить первую публичную версию проекта как open-source core и одновременно подготовить коммерческий контур для paid pilot.
- Целевая аудитория документа: основатель, технический лидер, внешний юрист, внешний финансовый консультант.
- Ожидаемое решение:
  утвердить open-core модель,
  дату первой публикации,
  стартовый pricing,
  обязательные юридические артефакты
  и KPI первой коммерческой итерации.

## 3. Факты, допущения и границы

### Подтвержденные факты
- Проект уже позиционируется как cross-platform toolkit для multi-agent AI workflows в репозиториях разных стеков.
- В проекте есть рабочий CLI/hub surface, multi-agent pipeline, role model, tests и roadmap.
- По состоянию на 2026-03-12 локальный test gate прошел успешно: `324 pass`, `1 skipped`.
- Internal pilot baseline уже собран на реальных проектах:
  `8` completed runs и `6` quality ratings в агрегате.
- По roadmap проект уже не находится "до real-project pilot",
  но всё еще находится до paid-client validation
  и до доказанного enterprise-scale продукта.

### Рабочие допущения
- Первая публикация нужна не как финальный коммерческий запуск, а как controlled public release.
- На горизонте до 2026-03-26 главная цель не recurring SaaS revenue, а первый paid pilot или минимум 2 подтвержденных коммерческих диалога.
- Публикация будет ориентирована на developer audience и early adopters, а не на enterprise procurement.
- Юридический раздел этого документа является issue-spotting memo и требует верификации по актуальным нормам РК перед исполнением.

### Границы решения
- Не строить за этот спринт multi-tenant SaaS, billing, SSO или полноценный hosted platform.
- Не обещать клиентам SLA, которого еще нет верифицированного pilot-данными.
- Не конкурировать с OpenClaw в категории universal AI assistant across channels.

## 4. Исполнительное решение

### Базовое решение
- Выпустить `open-source core` 22 марта 2026 года.
- Использовать модель `open-core + paid pilot + implementation/integration services`.
- Позиционировать проект не как "еще один coding agent", а как `repo-centric orchestration and quality layer for coding workflows`.
- Считать `GitLab` ближайшей практической интеграцией для коммерческого слоя,
  но не включать его в scope первого paid pilot.
- Считать `OpenClaw` дальней стратегической опцией,
  а не частью ближайшего коммерческого оффера марта 2026 года.

### Что публикуется в open-source core
- CLI и project hub.
- Multi-agent orchestration pipeline.
- Context pack, code indexing, prompt gate, validation, logs.
- Локальные примеры конфигурации и quick-start.
- Тесты, базовая документация, roadmap и launch note.

### Что остается вне публичного core и может стать paid layer
- Team/shared memory.
- Approval workflows.
- Audit dashboard and reporting.
- GitLab integration package.
- Jira integration package.
- Hosted control plane.
- Future distribution adapters, включая OpenClaw, если гипотеза подтвердится позже.
- Paid onboarding, implementation and support.

## 5. Позиционирование относительно OpenClaw

### Рабочая формулировка
- OpenClaw решает задачу gateway, channels, sessions, skills ecosystem и agent runtime distribution.
- `ai-hub-coding` должен решать задачу quality-controlled repo-native coding orchestration.

### Практический тезис для рынка
- `OpenClaw brings the session and interface surface.`
- `ai-hub-coding brings codebase-aware orchestration, debate, critique, validation and repo workflow discipline.`

### Статус OpenClaw в этой стратегии
- `OpenClaw` не входит в обязательный scope релиза `2026-03-22`.
- `OpenClaw` не входит в основной платный оффер ближайших 2 недель.
- `OpenClaw` остается долгосрочной гипотезой
  как distribution/runtime channel или future adapter.

### Приоритет интеграций
- `GitLab`:
  ближайшая коммерческая интеграция для рынка Казахстана и repo workflow.
- `Jira`:
  optional post-pilot add-on, если клиенту нужен ticket-to-delivery flow.
- `OpenClaw`:
  long-term strategic option, не мартовский deliverable.

### Что не говорить в первой публикации
- Не утверждать, что проект уже лучше OpenClaw "вообще".
- Не обещать universal assistant experience across chat apps.
- Не обещать enterprise-ready governance до pilot validation.

## 6. Финансовая модель на первый этап

### Рекомендуемая модель монетизации
- Бесплатный open-source core для adoption, доверия и early feedback.
- Платный `Paid Pilot, 14 days` как основной денежный оффер на ближайшие 2 недели.
- `GitLab integration` держать как ближайший private add-on,
  но продавать только после pilot validation.
- `Jira` не включать в базовый мартовский пакет;
  предлагать только после pilot fit.
- `OpenClaw` не продавать в мартовском оффере;
  держать как дальнейшую стратегическую опцию.
- Дополнительно: paid support/advisory на фиксированной ставке только вне рамок пилота.
- Публикацию 22 марта 2026 года считать каналом лидогенерации, а не датой запуска подписочной модели.

### Стартовые цены
| Offer | Формат | Цена | Что входит |
|---|---|---:|---|
| OSS Core | self-serve | 0 USD | open-source code, docs, examples |
| Paid Pilot, 14 days | fixed fee | 3,000 USD | 1 repo, 1 team, fixed scope, 8-10 pilot tasks, measurement, readout |
| GitLab integration | post-pilot add-on | 3,000 USD | private integration scope, only after paid pilot validation |
| Jira add-on | post-pilot only | quote separately | optional workflow after pilot validation |
| Scope extension beyond pilot | change request | 1,000 USD+ | extra repo, extra workflow or custom change request |
| Advisory / Support | optional | 100-200 USD per hour | architecture review, workflow diagnostics, commercial prep |

### Трехсценарная оценка до 2026-03-26
| Сценарий | Revenue | Ключевое условие | Вывод |
|---|---:|---|---|
| Stress | 0 USD | публикация состоялась, но pilot не продан | фокус на feedback, docs и 2-й wave outreach |
| Base | 3,000 USD | закрыт 1 paid pilot | план считается коммерчески подтвержденным |
| Conservative | 3,000 USD | pilot продан, но delivery занял больше planned scope | нужно пересматривать pricing и delivery capacity |
| Optimistic | 6,000 USD | закрыт 1 paid pilot и согласован post-pilot GitLab phase | можно переходить к апрельскому pipeline активных продаж |

### Финансовые KPI до 2026-03-26
- Не менее `10` целевых outreach contacts.
- Не менее `3` квалифицированных коммерческих диалогов к `2026-03-22`.
- Не менее `2` направленных коммерческих предложений к `2026-03-24`.
- Не менее `1` подписанного paid pilot к `2026-03-26`.
- Не менее `1` discovery call из warm network к `2026-03-23`.
- `Booked revenue >= 3,000 USD` к `2026-03-26`.
- `Upfront cash >= 2,100 USD` к `2026-03-26`, целевой уровень `3,000 USD`.
- Прямые API/inference затраты на один pilot `<= 500 USD`.

### Главные финансовые риски
| Риск | Severity | Влияние | Митигация | Owner |
|---|---|---|---|---|
| Слишком ранний уход в SaaS build-out | high | burn времени без выручки | продавать fixed-scope pilot, не platform subscription | Founder |
| Слишком низкая цена | medium | неправильный сигнал рынку и перегрузка поддержкой | держать fixed-fee pricing и scope limits | Founder |
| Слишком широкий scope пилота | high | delivery overrun | отдельный SOW и change request вне базового scope | Founder |
| Недооценка model costs | medium | отрицательная unit economics пилота | включать model costs в assumptions и cap API spend | Founder |
| Низкая предоплата | high | кассовый разрыв и неоплаченная работа | не стартовать delivery без `>= 70%` upfront | Founder |

## 7. Юридическая позиция и issue-spotting memo

### Рекомендуемая лицензия для первого публичного релиза
- Рекомендуемая рабочая позиция: `Apache License 2.0` для open-source core.

### Почему Apache-2.0 выглядит предпочтительно на первом этапе
- Лицензия допускает commercial use, modification and distribution.
- Лицензия содержит выраженный patent grant, что полезно для доверия B2B adoption.
- Лицензия совместима с логикой open-core,
  где monetization строится не на закрытии базового кода,
  а на закрытии managed and enterprise layer.

### Что должно быть явно отделено от open-source core
- Приватные интеграционные адаптеры.
- Командные policy packs.
- Shared memory services.
- Commercial support commitments.
- Proprietary deployment automation.

### Юридические риски до первой публикации
- `High:` Неопределенность прав на код.
  Действие: проверить авторство и внешние заимствования.
- `High:` Нет `CONTRIBUTING.md` и inbound contribution policy.
  Действие: утвердить правила внешних contribution до публикации.
- `High:` Нет явного `LICENSE`.
  Действие: добавить `LICENSE` до `2026-03-22`.
- `Medium:` Непрозрачность коммерческого слоя.
  Действие: опубликовать clear boundary note.
- `Medium:` Вопросы персональных данных и секретов в логах.
  Действие: опубликовать data handling note и минимизацию логирования.
- `Medium:` Налоговая квалификация services и future SaaS.
  Действие: провести separate tax review до invoicing.

### Обязательные юридические и governance артефакты до 2026-03-22
- `LICENSE`
- `README` с clear product scope
- `CONTRIBUTING.md`
- `docs/USER_AGREEMENT.md` или эквивалентный legal notice в `README`
- `SECURITY.md`
- `PRIVACY / data handling note` для логов, prompts и repository data
- `Commercial boundary note` с пояснением, что именно относится к paid layer
- Внутренний IP checklist по авторству и заимствованиям

### Юридические вопросы, которые требуют отдельной проверки по РК
- Авторские права на код, созданный работником, основателем или подрядчиком.
- Передача имущественных прав и допустимость публикации всего состава репозитория.
- Порядок обработки персональных данных, если в логах, prompts или pilot repositories могут появляться identifiable data.
- Налоговая модель для fixed-fee services, cross-border payments, foreign cloud/API costs и возможного будущего hosted layer.
- Договорная рамка для paid pilot: scope, acceptance criteria, confidentiality, IP allocation, limitation of liability.

### Внутренний юридический дисклеймер
> Настоящий документ подготовлен для внутреннего планирования
> коммерциализации open-source проекта
> и не является окончательным юридическим заключением.
> Все правовые выводы,
> включая вопросы лицензирования,
> авторских прав,
> персональных данных,
> налогообложения
> и договорной конструкции,
> подлежат дополнительной проверке
> по актуальному законодательству Республики Казахстан
> и применимым международным условиям
> до момента публикации и заключения сделок.

## 8. Публикационный календарь с датой первой публикации 22 марта 2026 года

| Дата | Этап | Результат | Owner |
|---|---|---|---|
| 2026-03-12 | Freeze strategy | утвержден этот memo и publication target | Founder |
| 2026-03-13 | Legal baseline | выбран license path и список обязательных документов | Founder + legal reviewer |
| 2026-03-14 | OSS boundary | зафиксирован список OSS core vs paid layer | Founder |
| 2026-03-15 | Pricing pack | готов 1-page pricing и offer structure | Founder |
| 2026-03-16 | Publish assets draft | подготовлены README changes, comparison note, launch FAQ | Founder |
| 2026-03-17 | Legal/IP check | пройден внутренний IP and compliance checklist | Founder + legal reviewer |
| 2026-03-18 | Demo packaging | готов demo flow и integration note | Founder |
| 2026-03-18 | Integration choice freeze | `GitLab first`, `Jira later`, `OpenClaw long-term` зафиксировано | Founder |
| 2026-03-19 | Outreach list | собран short list из 10-15 target contacts | Founder |
| 2026-03-20 | Soft review | финальное ревью launch materials | Founder + trusted reviewers |
| 2026-03-21 | Release readiness gate | все обязательные документы на месте, текст заморожен | Founder |
| 2026-03-22 | First publication | публичный релиз OSS core | Founder |
| 2026-03-23 to 2026-03-26 | Post-release commercial validation | outreach, demos, first commercial calls | Founder |

## 9. Release readiness gate на 21 марта 2026 года
- `LICENSE` добавлен.
- `README` обновлен под новое позиционирование.
- Есть понятная формулировка `what is open / what is paid`.
- Удалены или закрыты sensitive files, secrets, accidental internal notes.
- Подготовлен короткий `launch post`.
- Есть минимум `1` рабочий demo path.
- Если делается интеграционный demo, то только `GitLab-first`.
- Подготовлен `pilot offer` в текстовом виде.
- Подготовлен минимальный `services agreement / pilot SOW` draft.

## 10. KPI и go/no-go после первой публикации

### KPI на 2026-03-26
- Публикация выполнена не позднее `2026-03-22`.
- Минимум `10` целевых контактов получили outreach.
- Минимум `2` discovery calls проведены.
- Минимум `1` коммерчески осмысленный pilot discussion дошел до scope discussion.

### Go
- есть публикация;
- есть качественный feedback;
- есть хотя бы один платный pilot path или очень близкий коммерческий диалог.

### No-Go / Rework
- публикация задержана;
- лицензия и OSS boundary не оформлены;
- рынок не понял позиционирование;
- нет даже начального интереса к paid pilot.

## 11. Следующие документы после этого memo
- Public launch checklist.
- Pricing one-pager.
- OSS vs Paid boundary note.
- Pilot offer brief.
- GitLab add-on scope note.
- Draft services agreement / SOW.
- Privacy and data handling note.

## 12. Источники для верификации
- Репозиторий проекта:
  - `/home/kair/ai_agents_coding/ai-hub-coding/README.md`
  - `/home/kair/ai_agents_coding/ai-hub-coding/package.json`
  - `/home/kair/ai_agents_coding/ai-hub-coding/ai/ROADMAP.md`
  - `/home/kair/ai_agents_coding/ai-hub-coding/ai/PILOT_RUNBOOK.md`
  - `/home/kair/ai_agents_coding/ai-hub-coding/ai/agents.json`
- Apache License 2.0:
  - https://www.apache.org/licenses/LICENSE-2.0
  - https://opensource.org/license/apache-2-0/
- OpenClaw:
  - https://docs.openclaw.ai/
  - https://docs.openclaw.ai/tools/skills
  - https://docs.openclaw.ai/gateway/index
  - https://github.com/openclaw/openclaw
- Республика Казахстан, для отдельной правовой верификации:
  - https://adilet.zan.kz/rus/docs/Z960000006_
  - https://adilet.zan.kz/rus/docs/Z1300000094
  - https://adilet.zan.kz/rus/docs/K2500000120
