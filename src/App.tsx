
import './App.css'
import './index.css'
import InteractiveParticles from './components/interactive-particles/interactive-particles'

function App() {

  return (
   <div className='w-full h-full'>
  <InteractiveParticles 
  image="/example.jpg"
  threshold={255}
  density={0.5}
  color="#bbbbbb"
  size={0.5}
  className="rounded-lg shadow-xl"
/>
   </div>
  )
}

export default App
