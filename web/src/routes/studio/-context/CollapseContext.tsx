import { type Accessor, createContext, createSignal, type JSX, type Setter, useContext } from 'solid-js'

type CollapseContextType = {
  collapsed: Accessor<boolean | undefined>
  setCollapsed: Setter<boolean | undefined>
}

const CollapseContext = createContext<CollapseContextType>()

export const CollapseProvider = (props: { children: JSX.Element }) => {
  const [collapsed, setCollapsed] = createSignal<boolean | undefined>()

  return <CollapseContext.Provider value={{ collapsed, setCollapsed }}>{props.children}</CollapseContext.Provider>
}

export const useCollapse = () => {
  return useContext(CollapseContext)
}
