import { useEffect, useRef, useState, useCallback } from 'react'

const API_URL = import.meta.env.VITE_API_URL || (
  window.location.hostname === 'localhost' ? 'http://localhost:8000' : window.location.origin
)
const WS_URL = API_URL.replace(/^http/, 'ws')

export default function useDuelWebSocket(dueloId) {
  const [connected, setConnected] = useState(false)
  const [gameState, setGameState] = useState({
    phase: 'connecting',
    ronda: 1,
    atacanteId: null,
    isAtacante: false,
    isArquero: false,
    pateadorNombre: null,
    pateadorPosicion: null,
    pateadorValor: 0,
    arqueroNombre: null,
    arqueroValor: 0,
    golesRetador: 0,
    golesRival: 0,
    retadorNombre: '',
    rivalNombre: '',
    retadorId: null,
    rivalId: null,
    ganadorId: null,
    duracion: 10,
    resultado: null,
    retadorJugadores: [],
    rivalJugadores: [],
  })
  const wsRef = useRef(null)
  const onMessageRef = useRef(null)

  const sendMessage = useCallback((msg) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg))
    }
  }, [])

  const shoot = useCallback((posicion, fuerza = 50) => {
    sendMessage({ type: 'shoot', posicion, fuerza })
  }, [sendMessage])

  const defend = useCallback((posicion) => {
    sendMessage({ type: 'defend', posicion })
  }, [sendMessage])

  useEffect(() => {
    if (!dueloId) return

    const token = localStorage.getItem('token')
    if (!token) return

    const url = `${WS_URL}/ws/duel/${dueloId}?token=${token}`
    let ws = new WebSocket(url)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      setGameState((s) => ({ ...s, phase: 'waiting' }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)
      handleMessage(data, setGameState, sendMessage)
      if (onMessageRef.current) {
        onMessageRef.current(data)
      }
    }

    ws.onclose = () => {
      setConnected(false)
    }

    ws.onerror = () => {
      setConnected(false)
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [dueloId])

  return {
    connected,
    gameState,
    shoot,
    defend,
    sendMessage,
    onMessage: (cb) => { onMessageRef.current = cb },
  }
}

function handleMessage(data, setState, sendMessage) {
  switch (data.type) {
    case 'match_start':
      setState((s) => ({
        ...s,
        phase: 'waiting',
        retadorNombre: data.retador,
        rivalNombre: data.rival,
        retadorId: data.retador_id,
        rivalId: data.rival_id,
        golesRetador: 0,
        golesRival: 0,
      }))
      break

    case 'waiting_rival':
      setState((s) => ({ ...s, phase: 'waiting' }))
      break

    case 'animation_phase':
      setState((s) => ({
        ...s,
        phase: 'animation',
        ronda: data.ronda,
        duracion: data.duracion,
        pateadorNombre: data.pateador_nombre,
        pateadorPosicion: data.pateador_posicion,
        arqueroNombre: data.arquero_nombre,
        retadorJugadores: data.retador_jugadores || [],
        rivalJugadores: data.rival_jugadores || [],
        resultado: null,
      }))
      break

    case 'penalty_phase':
      setState((s) => {
        const userId = getUserId()
        return {
          ...s,
          phase: 'penalty',
          ronda: data.ronda,
          atacanteId: data.atacante_id,
          isAtacante: userId === data.atacante_id,
          isArquero: userId === data.arquero_id,
          pateadorNombre: data.pateador_nombre,
          pateadorPosicion: data.pateador_posicion,
          pateadorValor: data.pateador_valor,
          arqueroNombre: data.arquero_nombre,
          arqueroValor: data.arquero_valor,
          duracion: data.timeout,
        }
      })
      break

    case 'result':
      setState((s) => ({
        ...s,
        phase: 'result',
        resultado: {
          es_gol: data.es_gol,
          posicion_atacante: data.posicion_atacante,
          posicion_arquero: data.posicion_arquero,
        },
        golesRetador: data.goles_retador,
        golesRival: data.goles_rival,
      }))
      break

    case 'match_end':
      setState((s) => ({
        ...s,
        phase: 'match_end',
        ganadorId: data.ganador_id,
        golesRetador: data.goles_retador,
        golesRival: data.goles_rival,
      }))
      break

    case 'match_cancelled':
      setState((s) => ({ ...s, phase: 'match_end', ganadorId: null }))
      break

    case 'rival_disconnected':
      setState((s) => ({ ...s, phase: 'waiting' }))
      break

    case 'rival_reconnected':
      break
  }
}

function getUserId() {
  try {
    const user = localStorage.getItem('user')
    if (user) return JSON.parse(user).id_usuario
  } catch {}
  return null
}
