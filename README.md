# mini-nest

Навчальний IoC-контейнер на TypeScript, який рекурсивно створює граф
залежностей за metadata параметрів конструктора.

## Запуск

```bash
npm install
npm run build
npm start
npm test
```

Запуск тестів у Docker:

```bash
docker compose run --rm api npm test
```

Для автоматичної перекомпіляції під час розробки:

```bash
npm run dev
```

Приклад захищеного запиту після `npm start`:

```bash
curl -i -H 'Authorization: Bearer demo' \
  -H 'X-Request-Id: example-request' localhost:3000/users/1
```

## Як це працює

Декоратор `@Injectable()` позначає клас як доступний контейнеру та зберігає
його scope через `Reflect.defineMetadata`. Коли клас має декоратор, TypeScript
з опціями `experimentalDecorators` і `emitDecoratorMetadata` генерує metadata
`design:paramtypes` — масив runtime-конструкторів параметрів. Контейнер читає
цей масив через `Reflect.getMetadata` і рекурсивно створює кожну залежність.
Без `emitDecoratorMetadata` TypeScript не генерує `design:paramtypes`, тому
контейнер не знає, які аргументи передавати конструктору.

Інтерфейси стираються під час компіляції та перетворюються в metadata на
`Object`. Для них `@Inject(token)` записує явний рядковий або символьний токен,
який контейнер зіставляє із зареєстрованим класом. Singleton-екземпляри
кешуються в межах одного контейнера, transient створюються щоразу, а поточний
шлях резолву використовується для виявлення циклічних залежностей.

## HTTP-маршрутизація

`@Controller(prefix)` зберігає базовий шлях на конструкторі контролера, а
`@Get(path)` і `@Post(path)` — HTTP-метод та локальний шлях на відповідному
методі прототипу. Router читає ці metadata, склеює повний шлях і зіставляє
динамічні сегменти на кшталт `:id` із фактичним URL. Dispatcher розбирає URL і
JSON-тіло, знаходить маршрут, отримує контролер із IoC-контейнера, викликає
handler та серіалізує результат у JSON.

Параметр-декоратор знає, куди підставити значення, завдяки аргументу
`parameterIndex`, який TypeScript передає декоратору. `@Body()`, `@Param(name)`
і `@Query(name)` записують для методу масив інструкцій, де індекс відповідає
позиції аргументу handler-а. Під час HTTP-запиту dispatcher читає ці metadata
з прототипу контролера та формує масив аргументів: тіло бере з розпарсеного
JSON, path-параметри — з результату зіставлення маршруту, query-параметри — з
`URLSearchParams`.

Для параметра `@Body()` dispatcher читає runtime-тип із `design:paramtypes`.
Якщо це DTO-клас, `ZodValidationPipe` перевіряє plain JSON за прив'язаною до
класу Zod 4 схемою, а потім створює екземпляр DTO. Невалідне тіло повертає HTTP
400 зі списком усіх полів і причин.

## Життєвий цикл HTTP-запиту

```text
HTTP request
    │
    ▼
Request context (AsyncLocalStorage + X-Request-Id)
    │
    ▼
Middleware
    │
    ▼
Guard ── false ──► 403 Forbidden
    │ true
    ▼
Interceptor: before
    │
    ▼
Pipe (Zod validation and transformation)
    │
    ▼
Handler
    │
    ▼
Interceptor: after
    │
    ▼
HTTP response

Any error from the request chain ──► ExceptionFilter ──► HTTP response
```

Guard виконується до валідації та вирішує, чи можна продовжувати запит.
Interceptor обгортає pipe і handler, тому може виконати код як до, так і після
їхнього виклику. `ExceptionFilter` розташований на зовнішньому рівні: він
перетворює `NotFoundError` на 404, `ValidationError` на 400, а невідомі помилки
на безпечний 500 без витоку повідомлення чи stack trace.

## Чому AsyncLocalStorage, а не глобальна змінна

Глобальна змінна не ізолює одночасні запити. Поки перший запит очікує на
`await`, event loop може почати другий і перезаписати глобальний `requestId`;
після відновлення перший запит побачить уже чуже значення. `AsyncLocalStorage`
зберігає окремий контекст для кожного асинхронного ланцюга. Тому сервіс або
логер глибоко в стеку читає правильний `requestId` без додавання цього
параметра до сигнатур усіх проміжних методів. Клієнтський `X-Request-Id`
зберігається, а за його відсутності dispatcher генерує UUID; те саме значення
повертається в заголовку відповіді.
