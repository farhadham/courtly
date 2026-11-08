# Success bodies are enveloped as `{ data }`

Every 2xx JSON body is `{ "data": … }`. Failures already used `{ "error": … }`, so the two keys
name the kind of response and a client can branch on which one is present without inspecting HTTP
status. The envelope is a type in `packages/contracts` (`ApiData<T>`), not a Zod schema: it wraps
the payload at the HTTP boundary (`apps/api/src/http/respond.ts`) and nothing validates it on the
way out. Payload schemas are untouched and still describe only what sits inside `data`.

Bare success bodies were the alternative. They read well for a single resource, but a client must
then distinguish a list from an object from an error by shape, and there is no stable place for
future response-level metadata. A single-key envelope costs one level of nesting and buys one
uniform unwrap in the web client and one uniform assertion in the HTTP tests.

**Considered options**

- _Bare success bodies_ — the spec's original shape. Rejected because list, item, and failure
  responses have no common marker, and adding response-level metadata later would reshape every
  payload.
- _`{ data, meta }` from day one_ — rejected as speculative: no endpoint writes `meta`, and adding
  it later is non-breaking for clients that ignore unknown keys.
- _A runtime-validated envelope schema_ — rejected because outbound validation is not part of the
  contract; server bugs should surface in tests, not turn a successful write into a 500 mid-flight.

**Consequences**

- The error handler keeps emitting `{ error }` untouched. Success and failure never share a key.
- `ApiData<T>` is the only addition to the contracts module; every existing schema parses the
  payload inside `data`, so the HTTP tests wrap `.data` and assert the same shapes as before.
- `GET /health` is enveloped too. It is part of the API surface, and leaving it bare would
  reintroduce the special case the envelope exists to remove.
- The web unwraps once, in `apps/web/src/lib/api.ts`; call sites see the payload type directly.
- `CONTRACTS_VERSION` moves to `0.2.0`, marking the wire-shape change.
