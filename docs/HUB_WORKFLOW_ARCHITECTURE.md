# Архитектура Жизненного Цикла Запроса в AI Hub (Workflow)

В этом документе подробно описан весь жизненный цикл (флоу) работы запроса в хабе, включая все вилки, итерации и фазы согласования (аппрува).

Флоу представляет собой многоуровневый конвейер (pipeline), где агенты работают параллельно или последовательно в зависимости от фазы, а также существуют циклы автоматической доработки (Approval Rounds) и автоматического расширения контекста (Lever 3).

## Диаграмма процесса (Mermaid)

```mermaid
flowchart TD
    Start([Пользователь: npm run ai -- --prompt="..."]) --> Context[Сборка Context Pack\n(Индекс, файлы, кэш)]
    Context --> PreProcess{Включен\n--prepost?}

    %% Pre-process Phase
    PreProcess -- Да --> PE[Agent: Prompt Engineer\nУлучшение/уточнение промпта]
    PE --> MainStart
    PreProcess -- Нет --> MainStart

    %% Main Debate: Proposals & Critiques
    MainStart[Начало основных дебатов] --> Proposals
    
    subgraph Debate [Main Debate (Параллельно)]
        Proposals[Фаза: Proposals\nАгенты генерируют независимые решения]
        Proposals --> Critiques[Фаза: Critiques\nАгенты критикуют решения коллег]
    end

    %% Consensus Phase
    Debate --> Consensus[Agent: Synthesizer\nСинтез финального ответа (Consensus)]
    Consensus --> ApprovalStart

    %% Approval Rounds
    subgraph ApprovalLoop [Approval Rounds (до 3 итераций)]
        ApprovalStart[Фаза: Approval\nАгенты голосуют: Agreed/Not Agreed]
        ApprovalStart --> AllAgreed{Все согласны?}
        AllAgreed -- Нет\n(Сбор revisionNotes) --> CheckRoundAppr{Итерация < 3?}
        CheckRoundAppr -- Да --> Revision[Agent: Synthesizer\nRevision: исправление по замечаниям]
        Revision --> ApprovalStart
        CheckRoundAppr -- Нет --> ApprovalDone[Консенсус не достигнут (Disputed)]
        AllAgreed -- Да --> ApprovalDone[Консенсус достигнут (Agreed)]
    end

    %% Lever 3 Expansion
    ApprovalDone --> TrustCheck[Анализ Trust Signal\nНе хватает контекста?]
    
    subgraph Lever3 [Lever-3 Expansion (до 2 итераций)]
        TrustCheck --> TriggerL3{Нужен Lever-3?}
        TriggerL3 -- Да --> CheckRoundL3{Итерация < 2?}
        CheckRoundL3 -- Да --> FetchSeams[Авто-подгрузка недостающих\nфайлов/методов (missingSeams)]
        FetchSeams --> L3Debate[Повтор: Proposals ➔ Critiques\n ➔ Consensus ➔ Approval\n(с расширенным промптом)]
        L3Debate --> TrustCheck
    end

    %% Devil's Advocate
    TriggerL3 -- Нет --> CheckRoundL3 -- Нет --> DAStart[Фаза: Devil's Advocate]

    subgraph Defense [Security & QA]
        DAStart[Agent: Devil's Advocate\nАтака на решение, поиск уязвимостей]
        DAStart --> PostProcess{Включен\n--test?}
        PostProcess -- Да --> Tester[Agent: Tester\nГенерация тестов/валидация]
        PostProcess -- Нет --> SaveOutput
        Tester --> SaveOutput
    end

    %% Output
    SaveOutput[Сохранение артефактов] --> PatchSafeCheck{Код Patch-Safe?}
    PatchSafeCheck -- Да --> ResultGood[Вывод: result.txt + patch-safe-result.md]
    PatchSafeCheck -- Нет --> ResultWarn[Вывод: result.txt + result-warning.txt\n(Только как совет)]
    
    ResultGood --> Finish([Конец])
    ResultWarn --> Finish
```

## Детальный разбор каждого этапа и ограничений (Лимиты и Вилки)

### 1. Инициализация и Подготовка Контекста
*   Анализируется запрос и собирается базовая "пачка" контекста (Context Pack) согласно `context.json`.
*   Если есть `--prepost`, запускается **Prompt Engineer** (`pre-process` фаза), который переписывает и дополняет изначальный пользовательский промпт, чтобы устранить двусмысленности. Дальше все агенты работают с этим улучшенным промптом.

### 2. Главные Дебаты (Main Discussion)
*   **Proposals (Предложения):** Все агенты, допущенные до фазы `proposal` (например, Architect, Developer, Reviewer), **параллельно** генерируют свои варианты решения. Каждый агент обязан выдать "Уровень уверенности" (Confidence Score 0-100%).
*   **Critiques (Критика):** Как только все предложения готовы, те же агенты **параллельно** читают предложения друг друга и пишут критику, находя слабые места.

### 3. Синтез (Consensus)
*   Выделенный агент (обычно `synthesizer` с флагом `consensus: true`) собирает оригинальный запрос + все предложения + всю критику и пишет **единый сводный ответ** (черновик).

### 4. Циклы утверждения (Approval Rounds) — До 3-х итераций
Здесь начинается первая внутренняя петля (while loop).
*   Агенты, участвующие в фазе `approval` (Architect исключен в новых версиях для ускорения цикла, участвуют Developer/Reviewer), читают черновик Синтезатора.
*   Каждый возвращает JSON с вердиктом: `agreed: true/false` и `notes` (замечания).
*   **Вилка:**
    *   Если **все** ответили `agreed: true` ➔ переходим дальше.
    *   Если **кто-то против** ➔ запускается шаг **Revision**. Синтезатору отправляются все замечания несогласных, и он переписывает черновик.
    *   *Лимит:* Цикл повторяется максимум **3 раза** (`MAX_APPROVAL_ROUNDS = 3`). Если на 3-й раз кто-то все еще не согласен, статус помечается как `AllAgreed = false` (Consensus Disputed), но процесс двигается дальше.

### 5. Механика глубокого копания (Lever-3 Expansion) — До 2-х итераций
Это самая тяжелая автоматическая вилка. Система оценивает финальный черновик (Trust Signal) и смотрит, жаловались ли агенты во время Approval, что им "не хватает данных" (`missingSeams`).
*   **Вилка:**
    *   Если уровень доверия высокий и нет запросов на новые файлы ➔ пропускаем.
    *   Если система понимает, что ответ не имеет "патч-безопасной опоры" (например, агент придумал метод, которого нет в контексте, или запросил чтение файла X) ➔ **срабатывает Lever 3**.
*   **Как работает Lever 3:**
    1. Инструмент парсит запрошенные методы/файлы (`missingSeams`).
    2. Извлекает этот код из проекта и формирует "Приложение" (Appendix).
    3. **Запускает весь цикл Дебатов с нуля!** (Только с суффиксом `lever3-1`). Снова параллельно делаются Proposals ➔ Critiques ➔ Consensus ➔ Approval (до 3 раундов).
*   *Лимит:* Этот тяжеловесный цикл может сработать **максимум 2 раза** (`MAX_LEVER3_EXPANSION_ROUNDS = 2`).

### 6. Фаза Адвоката Дьявола (Devil's Advocate)
Финальный консенсус (с учетом всех Approval и Lever-3 раундов) передается агенту `devils-advocate`.
*   Он намеренно пытается "сломать" решение: ищет проблемы безопасности, race conditions, edge-кейсы.
*   Генерирует `devils-advocate-report.md`.
*   *Вилка:* Если DA находит `CRITICAL_ISSUES` или средняя уверенность агентов (Average Confidence) упала ниже 60%, это помечается как провал доверия к коду.

### 7. Постобработка (Post-Process / Tester)
*   Если был передан флаг `--test`, агент `tester` берет согласованное решение и пишет/предлагает тесты для него, валидируя логику. Формирует `test-report.md`.

### 8. Сохранение результатов и Patch-Safe гейт
В самом конце оценивается "Trust header".
*   Если решение полностью обосновано кодом проекта и все агенты договорились: создается `patch-safe-result.md` — код можно безопасно копипастить.
*   Если были споры на этапе Approval (цикл прервался по лимиту), или сработали ворнинги у Адвоката Дьявола, или выдуман несуществующий код: создается **`result-warning.txt`**. Основной ответ `result.txt` получает заголовок `COPYPASTE_READY: NO` (использовать только как совет, код требует ручной доработки оператором).

*Итог по количеству прогонов моделей под капотом (в худшем сценарии):*
1 (Pre-process) + [3 (Proposals) + 3 (Critiques) + 1 (Consensus) + 3 * (3 Approvals + 1 Revision)] * 3 (Lever 3 x2) + 1 (Devil's Advocate) + 1 (Tester) = **Десятки запросов к API за один вызов** (именно поэтому они выполняются максимально параллельно).
