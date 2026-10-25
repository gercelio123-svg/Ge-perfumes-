require('dotenv').config();
const express=require('express'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const app=express();app.disable('x-powered-by');
// A rota de fotos precisa aceitar payload maior antes do parser geral.
const allowedOrigin='https://gercelio123-svg.github.io';
app.use((req,res,next)=>{const origin=req.get('origin');if(origin===allowedOrigin){res.set('Access-Control-Allow-Origin',allowedOrigin);res.set('Vary','Origin');res.set('Access-Control-Allow-Methods','GET,POST,DELETE,OPTIONS');res.set('Access-Control-Allow-Headers','Content-Type,x-admin-password')}if(req.method==='OPTIONS')return res.sendStatus(origin===allowedOrigin?204:403);next()});
app.use('/api/admin/upload-image',express.json({limit:'7mb'}));
app.use(express.json({limit:'50kb'}));
const file=process.env.DATA_FILE||path.join(__dirname,'data.json');
function read(){try{return JSON.parse(fs.readFileSync(file,'utf8'))}catch{return {products:[],orders:{}}}}
function save(data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2));fs.renameSync(tmp,file)}
function auth(req,res,next){const expected=process.env.ADMIN_PASSWORD;if(!expected||expected.length<12)return res.status(503).json({error:'Configure ADMIN_PASSWORD com 12 ou mais caracteres.'});const supplied=req.get('x-admin-password')||'';const a=crypto.createHash('sha256').update(expected).digest(),b=crypto.createHash('sha256').update(supplied).digest();if(!crypto.timingSafeEqual(a,b))return res.status(401).json({error:'Senha inválida'});next()}
const clean=p=>({id:String(p.id||crypto.randomUUID()),brand:String(p.brand||'').trim().slice(0,90),name:String(p.name||'').trim().slice(0,130),category:String(p.category||'Árabe').slice(0,60),size:String(p.size||'').trim().slice(0,50),price_cents:Math.round(Number(p.price)*100),stock:Number(p.stock),images:(Array.isArray(p.images)?p.images:[]).filter(x=>typeof x==='string'&&/^https:\/\//i.test(x)).slice(0,3)});
// Upload privado para armazenamento persistente de imagens no Cloudinary.
// As credenciais ficam somente no Render, nunca no navegador ou GitHub.
app.post('/api/admin/upload-image',auth,async(req,res)=>{
 try{
  const {CLOUDINARY_CLOUD_NAME:cloud,CLOUDINARY_API_KEY:key,CLOUDINARY_API_SECRET:secret}=process.env;
  if(!cloud||!key||!secret)return res.status(503).json({error:'Configure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY e CLOUDINARY_API_SECRET no Render.'});
  const value=req.body?.data;
  const match=typeof value==='string'&&/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if(!match)return res.status(400).json({error:'Escolha uma foto JPG, PNG ou WEBP.'});
  const bytes=Buffer.from(match[2],'base64');
  if(!bytes.length||bytes.length>5*1024*1024)return res.status(400).json({error:'A foto deve ter até 5 MB.'});
  const mime=match[1];
  const valid=mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:
    mime==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
    bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
  if(!valid)return res.status(400).json({error:'Arquivo de imagem inválido.'});
  const timestamp=Math.floor(Date.now()/1000),folder='perfumes-do-ge';
  const signature=crypto.createHash('sha1').update(`folder=${folder}&timestamp=${timestamp}${secret}`).digest('hex');
  const form=new FormData();
  form.append('file',`data:${mime};base64,${match[2]}`);
  form.append('api_key',key);form.append('timestamp',String(timestamp));form.append('folder',folder);form.append('signature',signature);
  const response=await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/image/upload`,{method:'POST',body:form,signal:AbortSignal.timeout(25000)});
  const result=await response.json();
  if(!response.ok||!/^https:\/\//.test(result.secure_url||''))throw Error('O serviço de imagens recusou o envio. Confira as credenciais.');
  res.json({url:result.secure_url});
 }catch(e){console.error('upload-image:',e.message);res.status(502).json({error:'Não foi possível salvar a foto. Verifique as configurações do serviço de imagens.'})}
});
app.get('/api/products',(req,res)=>res.json(read().products));
app.get('/api/health',(req,res)=>res.json({ok:true}));
app.post('/api/admin/products',auth,(req,res)=>{const p=clean(req.body);if(!p.brand||!p.name||!p.size||!Number.isSafeInteger(p.price_cents)||p.price_cents<0||!Number.isSafeInteger(p.stock)||p.stock<0)return res.status(400).json({error:'Dados inválidos'});const db=read();const idx=db.products.findIndex(x=>x.id===p.id);if(idx<0)db.products.push(p);else db.products[idx]=p;save(db);res.json(p)});
app.delete('/api/admin/products/:id',auth,(req,res)=>{const db=read();db.products=db.products.filter(x=>x.id!==req.params.id);save(db);res.json({ok:true})});
app.get('/api/admin/orders',auth,(req,res)=>res.json(Object.entries(read().orders).map(([id,o])=>({id,...o})).sort((a,b)=>b.created-a.created).slice(0,100)));
app.post('/api/checkout',async(req,res)=>{try{const token=process.env.MP_ACCESS_TOKEN,base=process.env.PUBLIC_BASE_URL;if(!token||!/^https:\/\//.test(base||''))return res.status(503).json({error:'Mercado Pago ainda não configurado no servidor.'});const lines=req.body.items;if(!Array.isArray(lines)||!lines.length||lines.length>30)return res.status(400).json({error:'Carrinho inválido'});const db=read(),items=[];for(const line of lines){const p=db.products.find(x=>x.id===String(line.id)),q=line.quantity;if(!p||!Number.isInteger(q)||q<1||q>20||q>p.stock||p.price_cents<1)return res.status(400).json({error:'Preço ou estoque indisponível. Atualize a página.'});items.push({id:p.id,title:(p.brand+' '+p.name).slice(0,150),quantity:q,currency_id:'BRL',unit_price:p.price_cents/100})}const id=crypto.randomUUID(),amount=items.reduce((s,i)=>s+Math.round(i.unit_price*100)*i.quantity,0);db.orders[id]={amount,status:'pending',created:Date.now(),items:lines};save(db);const r=await fetch('https://api.mercadopago.com/checkout/preferences',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-Idempotency-Key':id},body:JSON.stringify({items,external_reference:id,back_urls:{success:base+'/?payment=success',failure:base+'/?payment=failure',pending:base+'/?payment=pending'},notification_url:base+'/api/webhook/mercadopago'})});const result=await r.json();if(!r.ok||!result.init_point)throw Error('Mercado Pago recusou a criação do checkout');res.json({url:result.init_point,order_id:id})}catch(e){console.error('checkout',e.message);res.status(502).json({error:'Não foi possível iniciar o pagamento. Verifique a configuração do Mercado Pago.'})}});
app.post('/api/webhook/mercadopago',async(req,res)=>{const secret=process.env.MP_WEBHOOK_SECRET;if(!secret)return res.sendStatus(503);const id=String(req.query['data.id']||req.body?.data?.id||'');const signature=req.get('x-signature')||'',requestId=req.get('x-request-id')||'';const ts=/ts=([^,]+)/.exec(signature)?.[1],v1=/v1=([^,]+)/.exec(signature)?.[1];if(!/^\d+$/.test(id)||!ts||!v1||!requestId||Math.abs(Date.now()/1000-Number(ts))>300)return res.sendStatus(401);const digest=crypto.createHmac('sha256',secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest('hex');if(v1.length!==digest.length||!crypto.timingSafeEqual(Buffer.from(v1),Buffer.from(digest)))return res.sendStatus(401);res.sendStatus(200);try{const r=await fetch('https://api.mercadopago.com/v1/payments/'+id,{headers:{Authorization:'Bearer '+process.env.MP_ACCESS_TOKEN}});if(!r.ok)return;const p=await r.json(),db=read(),order=db.orders[String(p.external_reference)];if(order&&Math.round(Number(p.transaction_amount)*100)===order.amount&&p.currency_id==='BRL'){order.status=p.status==='approved'?'approved':p.status==='rejected'?'rejected':'pending';order.payment_id=id;save(db)}}catch(e){console.error('webhook',e.message)}});
app.get('/api/order/:id',(req,res)=>{const o=read().orders[req.params.id];if(!o)return res.sendStatus(404);res.json({status:o.status})});
app.get('/',(req,res)=>res.sendFile(path.join(__dirname,'index.html')));
app.listen(process.env.PORT||3000,()=>console.log('Perfumes do Ge iniciado'));
