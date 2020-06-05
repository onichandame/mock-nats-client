import {generate} from 'randomstring'
import {Subscription,Msg,MsgCallback,Sub,Client,FlushCallback,SubscriptionOptions} from 'ts-nats'

const createInbox=()=>
    generate({length:20,charset:'alphanumeric'})

export class MockNats extends Client{
  private _connected:boolean
  private _subs:Sub[]
  createInbox:typeof createInbox
  constructor(){
    super()
    this._connected=false
    this._subs=[]
    this.createInbox=createInbox
  }
  private get connected(){return this._connected}
  private set connected(c:boolean){this._connected=c}
  private get subs(){return this._subs}
  private set subs(s:Sub[]){this._subs=s}
  public connect():Promise<Client>{
    return new Promise((resolve,reject)=>{
    this.connected=true
    setTimeout(()=>resolve(this),10)
    })
  }
  public close(){
    this.subs=[]
    this.connected=false
    setTimeout(()=>this.emit('disconnect'),10)
  }
  public async flush(cb?:FlushCallback):Promise<void>{
    if(cb) cb()
  }
public async publish(subject:string,data?:any,reply?:string):Promise<void>{
}
public async subscribe(subject:string,cb:MsgCallback,opts?:SubscriptionOptions){return new Subscription({subject,sid:Math.random(),callback:cb,received:0},this.protocolHandler)}
public async drain():Promise<any>{}
public async request(subject:string,timeout?:number,data?:any):Promise<Msg>{
  return{subject,sid:Math.random(),size:Math.random()
      
  }
}
public isClosed():boolean{return false}
public numSubscriptions():number{return Math.random()}
}
