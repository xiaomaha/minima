import { IconPlus } from '@tabler/icons-solidjs'
import { AutocompleteInput } from '@/shared/AutocompleteInput'

interface Props {
  suggestionList: string[]
  onCommit: (suggestion: string) => void
  onFocus: () => void
}

export const InlineSuggestion = (props: Props) => {
  return (
    <div class="relative w-full">
      <AutocompleteInput
        suggestions={props.suggestionList}
        placeholder=""
        onCommit={props.onCommit}
        dropdownClass="bg-base-200! max-h-100 overflow-y-auto flex-nowrap"
        inputClass="outline-0 border-none shadow-none max-w-xs hover:bg-base-200"
        selectFirstOnCommit
        clearInputOnCommit
        suggestionCount={10}
        class="mr-auto dropdown-top"
        icon={<IconPlus size={20} class="cursor-pointer shrink-0" />}
        onFocus={() => props.onFocus()}
        tabIndex={-1}
      />
    </div>
  )
}
