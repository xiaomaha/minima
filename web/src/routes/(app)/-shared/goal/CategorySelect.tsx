import { IconArrowNarrowRight, IconX } from '@tabler/icons-solidjs'
import { createMemo, For, type Setter } from 'solid-js'
import { createStore } from 'solid-js/store'
import { competencyV1GetClassificationTree } from '@/api'
import { AutocompleteInput } from '@/shared/AutocompleteInput'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'

export interface SelectionType {
  firstLevel: number
  secondLevel: number
  thirdLevel: number
  fourthLevel: number
}

interface Props {
  setClassIdForSkills: Setter<number | undefined>
}

export const CategorySelect = (props: Props) => {
  const { t } = useTranslation()

  const [classifications] = createCachedStore(
    'competencyV1GetClassificationTree',
    () => ({}),
    async () => {
      const { data } = await competencyV1GetClassificationTree()
      return data
    },
  )
  const [selection, setSelection] = createStore<SelectionType>({
    firstLevel: 0,
    secondLevel: 0,
    thirdLevel: 0,
    fourthLevel: 0,
  })

  const selected1 = () => classifications.data?.find((item) => item.id === selection.firstLevel)
  const selected2 = () => selected1()?.children?.find((c) => c.id === selection.secondLevel)
  const selected3 = () => selected2()?.children?.find((c) => c.id === selection.thirdLevel)

  const updateSelection = (key: keyof SelectionType, value: number, resetKeys: Array<keyof SelectionType>) => {
    setSelection(key, value)
    resetKeys.forEach((k) => {
      setSelection(k, 0)
    })
  }

  const allNodesDict = createMemo(() => {
    const dict: Record<string, number[]> = {}
    classifications.data?.forEach((l1) => {
      dict[l1.name] = [l1.id]
      l1.children?.forEach((l2) => {
        dict[`${l1.name} / ${l2.name}`] = [l1.id, l2.id]
        l2.children?.forEach((l3) => {
          dict[`${l1.name} / ${l2.name} / ${l3.name}`] = [l1.id, l2.id, l3.id]
          l3.children?.forEach((l4) => {
            dict[`${l1.name} / ${l2.name} / ${l3.name} / ${l4.name}`] = [l1.id, l2.id, l3.id, l4.id]
          })
        })
      })
    })

    return dict
  })

  const handleAutoCompleteCommit = (key: string) => {
    const ids = allNodesDict()[key]
    if (ids) {
      setSelection('firstLevel', ids[0] ?? 0)
      setSelection('secondLevel', ids[1] ?? 0)
      setSelection('thirdLevel', ids[2] ?? 0)
      setSelection('fourthLevel', ids[3] ?? 0)
    }
  }

  const validSelection = () => Object.values(selection).every((v: number) => v)

  return (
    <div class="space-y-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 items-end">
        <fieldset class="fieldset">
          <legend class="fieldset-legend">{t('Select competency category')}</legend>
          <select
            class="select"
            value={selection.firstLevel}
            onChange={(e) =>
              updateSelection('firstLevel', Number(e.target.value), ['secondLevel', 'thirdLevel', 'fourthLevel'])
            }
          >
            <option disabled value={0}>
              {t('First Level')}
            </option>
            <For each={classifications.data}>{(item) => <option value={item.id}>{item.name}</option>}</For>
          </select>
        </fieldset>

        <fieldset class="fieldset">
          <select
            class="select"
            value={selection.secondLevel}
            disabled={!selected1()?.children?.length}
            onChange={(e) => updateSelection('secondLevel', Number(e.target.value), ['thirdLevel', 'fourthLevel'])}
          >
            <option disabled value={0}>
              {t('Second Level')}
            </option>
            <For each={selected1()?.children}>{(item) => <option value={item.id}>{item.name}</option>}</For>
          </select>
        </fieldset>

        <fieldset class="fieldset">
          <select
            class="select"
            value={selection.thirdLevel}
            disabled={!selected2()?.children?.length}
            onChange={(e) => updateSelection('thirdLevel', Number(e.target.value), ['fourthLevel'])}
          >
            <option disabled value={0}>
              {t('Third Level')}
            </option>
            <For each={selected2()?.children}>{(item) => <option value={item.id}>{item.name}</option>}</For>
          </select>
        </fieldset>

        <fieldset class="fieldset">
          <select
            class="select"
            value={selection.fourthLevel}
            disabled={!selected3()?.children?.length}
            onChange={(e) => updateSelection('fourthLevel', Number(e.target.value), [])}
          >
            <option disabled value={0}>
              {t('Fourth Level')}
            </option>
            <For each={selected3()?.children}>{(item) => <option value={item.id}>{item.name}</option>}</For>
          </select>
        </fieldset>
      </div>

      <div class="flex flex-col md:flex-row gap-4 items-end">
        <div class="flex-1 w-full">
          <legend class="fieldset-legend text-xs mb-0.5">{t('Or Search competency categories directly')}</legend>
          <AutocompleteInput
            suggestions={Object.keys(allNodesDict())}
            placeholder={t('Type to search')}
            onCommit={handleAutoCompleteCommit}
            dropdownClass="bg-base-200! max-h-64 overflow-y-auto flex-nowrap"
            inputClass="w-full"
            selectFirstOnCommit
            suggestionCount={20}
          />
        </div>

        <button
          class="btn btn-primary"
          type="button"
          disabled={!validSelection()}
          onClick={() => props.setClassIdForSkills(selection.fourthLevel)}
        >
          <IconArrowNarrowRight />
          {t('View skills for this competency category')}
        </button>

        <button
          class="btn btn-sm btn-circle btn-ghost mb-1"
          type="button"
          onClick={() => {
            setSelection({ firstLevel: 0, secondLevel: 0, thirdLevel: 0, fourthLevel: 0 })
            props.setClassIdForSkills()
          }}
        >
          <IconX size={20} />
        </button>
      </div>
    </div>
  )
}
