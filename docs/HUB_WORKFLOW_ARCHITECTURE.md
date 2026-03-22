# Архитектура Жизненного Цикла Запроса в AI Hub (Workflow)

В этом документе подробно описан актуальный жизненный цикл (pipeline) работы хаба, включая сборку контекста, интеллектуальный роутинг, фазы дебатов и механизмы защиты (Cost Optimization & Trust Gating).

Флоу представляет собой динамический конвейер: он умеет адаптироваться под сложность задачи, переиспользовать кэш, точечно подтягивать недостающий код (Seam Expansion) и отключать ненужные этапы ради экономии токенов (Pipeline Cost Optimization).

## Диаграмма процесса (Mermaid)

```mermaid
flowchart TD
    Start([Пользователь: npm run ai -- --prompt="..."]) --> Bootstrap[Bootstrap: Сборка stack-profile.json\n(Определение языка, фреймворков)]
    Bootstrap --> Caching{Архив содержит\nтакой же промпт?}
    
    %% Pre-process Phase
    Caching -- Да --> ReusePE[Reuse: переиспользование\nартефакта preprocess]
    Caching -- Нет --> PE[Agent: Prompt Engineer\n(Уточнение промпта, классификация сложности)]
    ReusePE --> Context
    PE --> Context
    
    %% Context Pack
    Context[Сборка Context Pack L0/L1/L2\n(AST-анализ, outline, body)] --> Routing{Complexity Routing\n(Сложность?)}

    %% Main Debate: Proposals & Critiques
    Routing -- Trivial --> DebateTrivial[Упрощенный цикл:\n1 Proposal ➔ 1 Critique]
    Routing -- Standard --> DebateStd[Стандартный цикл:\n2 Агента (Proposals ➔ Critiques)]
    Routing -- Architectural --> DebateFull[Полный цикл:\n3 Агента (Proposals ➔ Critiques)]
    
    DebateTrivial --> Consensus
    DebateStd --> Consensus
    DebateFull --> Consensus

    %% Consensus Phase
    Consensus[Agent: Synthesizer\nСинтез: Grounded Fixes vs Assumptions]
    Consensus --> ApprovalStart

    %% Approval Rounds
    subgraph ApprovalLoop [Approval Rounds (до 2 итераций)]
        ApprovalStart[Фаза: Approval\nГолосование и сбор missingSeams]
        ApprovalStart --> AllAgreed{Все согласны?}
        
        AllAgreed -- Нет --> CheckSeams{Есть missingSeams\nи trust gap?}
        CheckSeams -- Да --> TriggerSeamExp[Срабатывание Seam Expansion\n(ранний выход из Approval)]
        CheckSeams -- Нет --> CheckRoundAppr{Итерация < 2?}
        
        CheckRoundAppr -- Да --> Revision[Agent: Synthesizer\nRevision: переписывание черновика]
        Revision --> ApprovalStart
        CheckRoundAppr -- Нет --> ApprovalDone[Консенсус не достигнут (Disputed)]
        AllAgreed -- Да --> ApprovalDone[Консенсус достигнут (Agreed)]
    end

    %% Seam Expansion
    TriggerSeamExp --> FetchSeams[Seam Expansion:\nПоиск и извлечение нового кода (L3)]
    FetchSeams --> L3Debate[Повтор цикла Дебатов\nс расширенным контекстом]
    L3Debate --> ApprovalStart

    ApprovalDone --> TrustCheck[Анализ Trust Signal\n(patchSafeEligible?)]
    
    %% Devil's Advocate
    TrustCheck --> DAGate{DA Gate:\nНужен ли DA?}
    DAGate -- Пропуск\n(Чистый run или Diagnostic) --> TesterGate
    DAGate -- Нужен --> DAStart[Agent: Devil's Advocate\nАтака на решение, поиск уязвимостей]
    DAStart --> TesterGate

    %% Post Process
    TesterGate{Tester включен?}
    TesterGate -- Да --> Tester[Agent: Tester\nPatch-validation или Diagnostic-review]
    TesterGate -- Нет --> SaveOutput
    Tester --> SaveOutput

    %% Output
    SaveOutput[Сохранение артефактов] --> FinalCheck{Код Patch-Safe?}
    FinalCheck -- Да --> ResultGood[Вывод: patch-safe-result.md]
    FinalCheck -- Нет --> ResultWarn[Вывод: result-warning.txt\n(Только как совет)]
    
    ResultGood --> Finish([Конец])
    ResultWarn --> Finish
```

## Детальный разбор каждого этапа и архитектурных механизмов

### 1. Bootstrap и Stack-Profile
На старте система вызывает `detectProjectStack` (или использует существующий `stack-profile.json`). Хаб автоматически определяет языки, фреймворки, базы данных и монорепозиторные скоупы (Scopes), чтобы формировать контекст и подгружать нужные навыки (Skills).

### 2. Preprocess и Caching
Запускается **Prompt Engineer**. Он переписывает промпт и определяет его сложность (Complexity).
* **Preprocess Reuse:** Если этот же промпт уже запускался ранее, хаб пропускает вызов агента и переиспользует старый `preprocess` артефакт из кэша (экономия токенов).

### 3. Умная сборка контекста (Context Pack)
Контекст собирается не слепым дампом, а через систему **Context Pack (L0/L1/L2)**, использующую AST-парсинг (Tree-Sitter):
* **L0 (Outline):** Для высокоуровневых/архитектурных промптов подгружаются только "скелеты" файлов (сигнатуры классов и методов).
* **L1 (Body):** Стандартный уровень. Для маленьких файлов (эвристика < 150 строк) отдается все тело целиком во избежание лишних "раунд-трипов" к LLM.
* **L2 (Deep Analysis / Call Graph):** Для дебаггинга или сложных расследований подгружаются тела зависимостей и граф вызовов (с жесткими ограничениями для динамических языков вроде JS/Python, чтобы не утопить агентов в мусоре).

### 4. Complexity-Based Routing (Роутинг по сложности)
В зависимости от классификации Prompt Engineer, система выбирает "вес" дебатов, оптимизируя затраты (Pipeline Cost Optimization):
* **Trivial (Опечатки, конфиги):** 1 предложение ➔ 1 критика (без DA).
* **Standard (Багфиксы, фичи):** 2 агента.
* **Architectural (Рефакторинг):** 3 агента (полный состав).

### 5. Главные Дебаты (Main Discussion)
Допущенные агенты (Architect, Developer, Reviewer) параллельно генерируют **Proposals** (предложения). Затем они читают предложения коллег и пишут **Critiques** (критику).

### 6. Синтез (Consensus)
`Synthesizer` собирает результаты в единый драфт, строго соблюдая **Evidence-Grounded Patch Mode**:
* **Grounded Fixes:** Только то, что железобетонно доказано прочитанным кодом.
* **Assumptions / Unverified Seams:** Любые допущения о "непрочитанном" коде или поведении ниже по потоку. Угадывать факты в блоке Grounded Fixes жестко запрещено (чтобы избежать `role-evidence-divergence`).

### 7. Approval Rounds (до 2-х итераций)
Агенты оценивают черновик с учетом ролевой специфики (Reviewer смотрит на общую суть, Developer — на строгость улик).
* Если есть спор о логике, Синтезатор делает **Revision** (переписывает черновик). Максимум 2 раунда вместо старых 3-х.
* Если спор возникает исключительно из-за нехватки улик (`missingSeams`), петля Approval может быть прервана досрочно для запуска Seam Expansion (Round Orchestration Phase 1).

### 8. Seam Expansion (Ранее Lever-3)
Если агенты требуют дополнительный контекст (определены точные `missingSeams` с `fetchHint`) и есть проблемы с доверием (Trust gap), хаб **автоматически подтягивает нужные методы/файлы** из проекта и перезапускает цикл дебатов с расширенным контекстом. Механизм `seam fetch precision` обеспечивает точный парсинг даже "грязных" и неоднозначных запросов от агентов.

### 9. Devil's Advocate (DA Gate)
DA атакует финальное решение на предмет уязвимостей.
* **Conditional Skip:** Чтобы не тратить токены, DA **отключается**, если:
  1. Это чистый запуск (все агенты согласны, `avgApprovalScore >= 9`, код `patch-safe`).
  2. Это статус `DIAGNOSTIC` без доступных для подгрузки улик.

### 10. Post-Process (Tester)
Агент Tester валидирует решение.
* **Сплит режимов:** Если патч готов (`patch-safe`), он работает в режиме `patch-validation` (генерация тестов). Если патча нет (`DIAGNOSTIC`), он работает в легком режиме `diagnostic-review`.

### 11. Сохранение результатов и Trust Gate
Оценка финального доверия к коду:
* **`patch-safe-result.md`:** Создается, если код доказан, все швы закрыты, агенты согласны. Можно безопасно копипастить.
* **`result-warning.txt` (DIAGNOSTIC):** Создается, если остались `substantive-assumptions`, разногласия ролей (`role-evidence-divergence`) или ворнинги DA. Результат используется только как совет, патч не выдается на авто-применение.