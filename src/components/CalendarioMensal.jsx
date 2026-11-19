import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { resumoCalendario } from '../lib/calendario.js'
import { corInline } from '../lib/status.js'
import { mesAtualSaoPaulo } from '../lib/datas.js'

const fmt = (y,m,d) => `${y}-${String(m+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`
const formatarMes = (y,m) => new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m,1)))

export default function CalendarioMensal({filtros,personalizados,onSelectDia,refreshKey}) {
  const [mes,setMes] = useState(() => mesAtualSaoPaulo())
  const [resumo,setResumo] = useState([])
  const [carregando,setCarregando] = useState(false)
  const [erro,setErro] = useState('')
  const {ano,mes:m} = mes
  const ultimo = new Date(Date.UTC(ano,m+1,0)).getUTCDate()
  const inicio = fmt(ano,m,1), fim = fmt(ano,m,ultimo)
  useEffect(()=>{
    let ativo=true
    setCarregando(true)
    resumoCalendario({inicio,fim,empresaId:filtros.empresaId,responsavelId:filtros.responsavelId,status:filtros.status})
      .then(r=>{if(ativo){setResumo(r);setErro('')}})
      .catch(e=>{if(ativo)setErro(e.message)})
      .finally(()=>{if(ativo)setCarregando(false)})
    return ()=>{ativo=false}
  },[inicio,fim,filtros.empresaId,filtros.responsavelId,filtros.status,refreshKey])
  const porDia=useMemo(()=>{
    const mapa={}
    for(const s of resumo) (mapa[s.dia]??=[]).push(s)
    return mapa
  },[resumo])
  const deslocamento = new Date(Date.UTC(ano,m,1)).getUTCDay()
  const semanas = Array.from({length:Math.ceil((deslocamento+ultimo)/7)*7},(_,i)=>{
    const dia=i-deslocamento+1
    return dia>=1&&dia<=ultimo?dia:null
  })
  const mudar=passo=>setMes(a=>{const dt=new Date(Date.UTC(a.ano,a.mes+passo,1));return {ano:dt.getUTCFullYear(),mes:dt.getUTCMonth()}})
  return <div className="monthly-calendar">
    <div className="month-heading"><button type="button" className="icon-btn" onClick={()=>mudar(-1)} aria-label="Mês anterior"><ChevronLeft/></button><h3>{formatarMes(ano,m)}</h3><button type="button" className="icon-btn" onClick={()=>mudar(1)} aria-label="Próximo mês"><ChevronRight/></button></div>
    {erro&&<p className="inline-error" role="alert">{erro}</p>}
    <p className="calendar-explanation">{carregando?'Atualizando calendário…':'Resumo de todos os registros autorizados no mês, sem limite de 25.'} Clique em um dia para consultar seus agendamentos na tabela. Busca por texto e horário são aplicadas na tabela após selecionar o dia.</p>
    <div className="month-grid" role="grid" aria-label={`Calendário de ${formatarMes(ano,m)}`}>
      {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(d=><div className="month-weekday" key={d}>{d}</div>)}
      {semanas.map((dia,i)=>{
        const data=dia&&fmt(ano,m,dia)
        const grupo=porDia[data]||[]
        const total=grupo.reduce((s,x)=>s+Number(x.quantidade),0)
        return dia?<button type="button" key={data} className="month-cell" onClick={()=>onSelectDia(data)} aria-label={`${dia} de ${formatarMes(ano,m)}: ${total} agendamentos`}>
          <strong>{dia}</strong>{total>0&&<span className="month-count">{total} ag.</span>}
          <span className="month-dots">{grupo.slice(0,5).map(x=><span key={x.status} className="month-dot" title={`${x.status}: ${x.quantidade}`} style={{backgroundColor:corInline(x.status,personalizados).color||'#8fa2bd'}}/>)}</span>
        </button>:<div className="month-cell month-cell-empty" key={`empty-${i}`}/>
      })}
    </div>
  </div>
}
