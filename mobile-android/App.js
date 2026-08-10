import React from 'react'
import { SafeAreaView, Text, Button, View, Switch } from 'react-native'

export default function App() {
  const [running, setRunning] = React.useState(false)
  const [expected, setExpected] = React.useState('--')

  React.useEffect(() => {
    async function fetchActions() {
      try {
        const r = await fetch('http://10.0.2.2:3000/actions')
        const actions = await r.json()
        const total = actions.reduce((s,a)=>s+(a.expectedGain||0),0)
        setExpected(total.toFixed(6))
      } catch (e) {
        setExpected('err')
      }
    }
    fetchActions()
  }, [])

  return (
    <SafeAreaView style={{flex:1, alignItems:'center', justifyContent:'center'}}>
      <Text style={{fontSize:20, fontWeight:'bold'}}>khoja bot</Text>
      <View style={{flexDirection:'row', margin:12}}>
        <Button title={running? 'Stop': 'Start'} onPress={() => setRunning(!running)} />
      </View>
      <View style={{marginTop:20}}>
        <Text>Expected total gain: {expected}</Text>
        <Text>Actual total gain: --</Text>
      </View>
    </SafeAreaView>
  )
}
