import {readBody,RequestError} from '../lib/request-security';
import {securityHeaders,previewFrameSources} from "../lib/security-headers";
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const requestPath=new URL(request.url).pathname;
    let checked=request,response:Response;
    try{
      if(requestPath.startsWith('/api/')&&request.method!=='GET'&&request.method!=='HEAD'&&request.headers.get('content-type')?.toLowerCase().split(';')[0].trim()==='application/json'){
        const max=requestPath==='/api/admin'?262144:requestPath==='/api/workspace/code'||requestPath==='/api/workspace/owner'?4096:requestPath==='/api/calendar'?16384:65536;
        const bytes=await readBody(request,max);
        const headers=new Headers(request.headers);headers.set('Content-Length',String(bytes.byteLength));
        checked=new Request(request,{headers,body:bytes as BodyInit});
      }
      response=await runWithConnectorBinding(binding, () => handler.fetch(checked, env, ctx));
    }catch(e){if(!(e instanceof RequestError))throw e;response=Response.json({error:e.message},{status:e.status});}

    const secured=new Response(response.body,response);
    for(const [name,value] of Object.entries(securityHeaders)){if(name==='Content-Security-Policy'&&secured.headers.get(name)?.includes('sandbox'))continue;secured.headers.set(name,value);}
    const path=new URL(request.url).pathname;
    if(env.CODEMATE_ENABLED==='true'&&['/codemate/playground','/codemate/discover'].includes(path)){const csp=secured.headers.get('Content-Security-Policy')||'';secured.headers.set('Content-Security-Policy',csp+"; frame-src "+previewFrameSources);secured.headers.set('Referrer-Policy','no-referrer');}
    if(path.startsWith('/p/')||path.startsWith('/impact/')||path.startsWith('/codemate')||path.startsWith('/admin')||path.startsWith('/studio')||path.startsWith('/api/'))secured.headers.set('Cache-Control','no-store');
    return secured;
  },
};
