> Touch water - my metaphore of brief but insightful exploration

HTTP/2 is a major revision of HTTP/1 that was officially standardize around 2015. That means, today (2026), it has been just over a decade since its release, and there are already supports in many major HTTP server library ready to be used. Running deep research prompts (woohoo AI) on the benefits of HTTP/2, I can see major improvements like better content streaming capabilities, reduced communication latency, and backwards compatibility. Many, if not all, major browsers right now also already support HTTP/2 connection too.

However, has it really been adopted anywhere? Even right now, the services that I have been developing and maintaining are still running on HTTP/1, considering that I am still using default `express` and `Nestjs` setup. There is no doubt that migrating from HTTP/1 to HTTP/2 might break things, but Nodejs has provided a compatibility layer to ensure easy migration of existing HTTP/1 services (See [HTTP/2 Compatibility API](https://nodejs.org/api/http2.html#compatibility-api)).

So, in this blog post, I am going to explore methods and challenges in HTTP/2 implementation as well as a little bit research on HTTP/3 and why is it not at all available -> all topics on **Nodejs**.

# Nodejs HTTP/2 module

My impression of Nodejs's HTTP/2 module is that they are built around the foundation of 'stream'. You have a listener on an event, and you process the arguments that was passed onto the listener. Very much like this:

```ts
stream.on('data', chunk => {
    process(chunk)
})
```

Therefore, every single connection that was made into your HTTP/2 server will be streamed to your server handler, and your handler should also be able to stream the response to your clients. All of these is done without having to setup 'keep-alive' and other headers like you usually do with HTTP/1 for streaming (e.g. chunked transport).

However, we are not interested in streaming (for now). Many of HTTP/1 services out there are in "Read request -> Process request -> Respond request" style. Usually, the read stage immediately transform the request body into a materialized object, and very rarely does it stream the request body to the process stage. This kind of streaming is dedicated to large body like uploading a huge file to the server.

Luckily, Nodejs has provided a [HTTP/2 Compatibility API](https://nodejs.org/api/http2.html#compatibility-api) that provides common properties of HTTP/1 request and response object into your handler like this.

```ts
import { createSecureServer } from 'node:http2';
const server = createSecureServer(secureOptions, (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('X-Foo', 'bar');
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('ok');
});
```

Done and dusted. Your traditional http server setup.

## HTTP/2 is "secure by default"

You _can_ set up HTTP2 server without SSL, but many major browsers out there require HTTP2 connection to be secure. This might add one extra steps in testing your server from a browser. Fortunately, setting up a key and a cert are easy nowadays. If you are on a Unix system, you may use the `openssl` program to generate a self-signed certificate to be supplied to your HTTP2 server.

```sh
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

And in your Nodejs server setup:

```ts
import { readFileSync } from 'fs';
import { createSecureServer } from 'node:http2';
const secureOptions = {
    key: readFileSync('./key.pem'),
    cert: readFileSync('./cert.pem'),
    allowHttp1: true, // <-- important! allow compat with old client, e.g. Nodejs fetch
}
const server = createSecureServer(secureOptions, (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('X-Foo', 'bar');
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('ok');
});
```

# `express` with HTTP/2

`express` is a great library of http server that provides thin layer of utilities and features while still leveraging Nodejs internal http features. Plus, there are also many libraries out there that are built for `express` and used by many common http servers (notable mentions: cors, helmet).

> It is also unfortunate that my experience with debugging routes of `express` has been painful and uninsightful. I will elaborate on this more on a different blog post if required.

When creating an `express` app, there are actually two ways to start serving your service:

```ts
const app = express()

app.listen(1234, () => {
    console.log('Listening at port 1234')
})

import http from 'node:http'

const server = http.createServer(app)
server.listen(1235, () => {
    console.log('Listening at port 1235')
})
```

This is because the `app` itself is a handler function. That means are can replace `http` with `http2` like this:

```ts
const app = express()
const server = createSecureServer(secureOptions, app);
```

However, upon running the server, there is an issue on how `express` handle the request and response object. Digging down into their source code, I found that their request and response object is inheriting prototype from HTTP/1 request and response object. On top of that, the handler function will overwrite the prototype of the request and response object to those of `express`.

This is an issue when passing request and response object from HTTP/2 because the compatibility layer by HTTP/2 has its own implementation of methods and properties that is not inheritting from classes of HTTP/1. As a result, we will encounter errors of "reading from `undefined`".

Luckily, we can work around it using [Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy). In this proxy, when a HTTP/1 prototype is assigned to the request/response object, we will utilize this prototype as soon as the requested property does not exist in HTTP/2 objects.

```ts
function applyPrototype<T>(requestOrResponse: T) {
    let proto: object | null = null;
    return new Proxy<T>(requestOrResponse, {
        get(target, prop, receiver) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const accessed = Reflect.get(target, prop, receiver);
          if (prop === 'app') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return accessed;
          }

          if (typeof accessed === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            return accessed.bind(target);
          }

          if (accessed !== undefined) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return accessed;
          }

          if (!proto) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return
            return accessed;
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const proxied = Reflect.get(proto, prop, receiver);

          if (typeof proxied === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            return proxied.bind(receiver);
          }

          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return proxied;
        },
        setPrototypeOf(_, v) {
            proto = v;
            return true;
        },
    })
}
```

A lot of things going around here, our goal is to bind properties available in HTTP/2 to its own and bind proxy properties with the proxy instance.

Once more, we are doing this instead of updating the prototype of the request and response object because the compatibility layer of HTTP/2 does not inherit from HTTP/1 classes. Therefore, this is a quick and easy method to add extra compatibility for our `express` app.

> Food for thought: Is `express` still a reasonable library for HTTP/2 server? Or do we need `express/2` that is dedicatedly built around HTTP/2 architecture? 

# Nestjs with HTTP/2

Now that we know how to setup http2 on `express`, let's bring this setup to our Nestjs application. Working with large-scale project, I have fell in love with the modularity and extensibility of Nestjs. It is basically Spring on JavaScript (hot take).

Internally, Nestjs uses `adapter` to allow multiple http platforms to run on Nestjs. It has two built-in platform that you can choose for your Nestjs server:
- Express
- [Fastify](https://docs.nestjs.com/techniques/performance)

To switch to a different platform, you may initiate your Nestjs application differently like this:

```ts
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';

const app = await NestFactory.create(AppModule, new FastifyAdapter());
await app.listen(process.env.PORT ?? 3000);
```

We can leverage the adapter class to allow http2 server in our Nestjs application. Since we already have `ExpressAdapter` class, we can simply extend from this class and override init http server function.

```ts
import { NestApplicationOptions } from '@nestjs/common';
import { ExpressAdapter } from '@nestjs/platform-express';
import http2 from 'node:http2';

export class Http2ExpressAdapter extends ExpressAdapter {
    initHttpServer(options: NestApplicationOptions): void {
    if (!options.httpsOptions) {
      throw new Error('Secure options must be provided to use http2');
    }

    const app = this.instance as Express;
    // this will break nestjs and express
    // some method is called without the proxy initialized
    // but also, fix security, remove server hints
    app.disable('x-powered-by');
    const server = http2.createSecureServer({ ...options.httpsOptions, allowHTTP1: true }, (req, res) => {
      Object.assign(req, { app });
      Object.assign(res, { app });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      app(extend(req) as any, extend(res) as any);
    });

    // also!! server is not inheriting from event emitter
    // nestjs will break without .once method
    // so let's just proxy one more method
    Object.assign(server, {
      once: (event: string, listener: (...args: any[]) => void) => {
        server.addListener(event, (...args) => {
          server.removeListener(event, listener);
          Reflect.apply(listener, void 0, args);
        });
      },
    });
    // @ts-expect-error compat handled
    this.setHttpServer(server);

    if (!options?.forceCloseConnections) return;

    const fn = Reflect.get(this, 'trackOpenConnections');
    if (!fn) return;

    Reflect.apply(fn, this, []);
  }
}

function extend(target: object) {
  let proto: object | null = null;
  return new Proxy(target, {
    get(target, prop, receiver) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const accessed = Reflect.get(target, prop, receiver);
      if (prop === 'app') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return accessed;
      }

      if (typeof accessed === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return accessed.bind(target);
      }

      if (accessed !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return accessed;
      }

      if (!proto) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return
        return accessed;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const proxied = Reflect.get(proto, prop, receiver);

      if (typeof proxied === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        return proxied.bind(receiver);
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return proxied;
    },
    setPrototypeOf(_, v) {
      proto = v;
      return true;
    },
  });
}
```

Apply your changes and _voila_, your Nestjs server is now running on HTTP/2!

# HTTP/2 - Why no adoption still?

When trying to plug in HTTP/2 to popular frameworks out there, it seems like I have done only "workarounds" that may not be maintainable in the future. This urges the need to develop solid codebase that is built around Nodejs HTTP/2 feature. As a result, this will probably add overhead and latency instead of the intended performance improvement we expect to achive from HTTP/2

However, it still puzzled me that there is no initiatives surfacing the web on to support HTTP/2 on Nodejs servers. No frameworks. No libraries. Nada. (Okay maybe there are but my point, they are not surfacing as much as other HTTP library)

Once more, I returned to the deep research prompt (woohoo AI once more), and it seems like the hype is gone because the benefits HTTP/2 offered is unable to compete with the trust of existing HTTP/1 frameworks and libraries. The good ol' "If it is not broken, why fix" principle.

While HTTP/2 has been standardized, HTTP/3 surfaced to the web as an improvement to HTTP/2.

# HTTP/3 - What happened?

One of the defining features of HTTP/3 is the transport layer that is it built on, which is QUIC. QUIC is a transport layer that is based on UDP, which means it does not have the standardised TCP handshake like HTTP/2 and HTTP/1 have.

That also means the foundation of that is built on HTTP/2 and HTTP/1 cannot be reused for HTTP/3, and it must be developed and added to the Nodejs native codebase. As I was researching through the timeline of the development of QUIC &times; HTTP/3 in the Nodejs repository, the initial effort to support this was started around [Sep 2018](https://github.com/nodejs/node/issues/23064) by the feature champion [James M Snell | github:jsnell](https://github.com/jasnell) with huge code changes. As a result, the development turned into tiny PRs that are meant to slowly build up the foundation of HTTP/3 module.

As of [Oct 2025](https://github.com/nodejs/node/issues/57281), experimental QUIC can be enabled using additional build flag, and there is still a long way to go until we will have our first HTTP/3 module in Nodejs. Currently, the feature is tracked in this issue on GitHub - [HTTP/3 support #38478](https://github.com/nodejs/node/issues/38478).

For now, if you needed a HTTP/3 server, you may build from any existing HTTP/3 application and expose the neseccary bindings to Nodejs. One of the repositories that I would suggest is [microsoft/msquic](https://github.com/microsoft/msquic).
