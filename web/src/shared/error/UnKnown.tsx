import i18n from '@/i18n'

export const UnKnown = ({ error }: { error: Error }) => {
  return (
    <div class="min-h-svh flex flex-col items-center justify-center gap-8 p-8 text-center">
      <div class="flex flex-col items-center gap-2">
        <span class="text-8xl font-black text-base-content/10 select-none leading-none">500</span>
        <h1 class="text-2xl font-bold text-base-content">{i18n.t('Something went wrong')}</h1>
        <pre class="text-left text-xs text-error bg-base-200 rounded-box p-4 max-w-2xl w-full overflow-auto max-h-64 mt-2">
          {error.stack}
        </pre>
      </div>
      <button type="button" class="btn btn-primary btn-sm" onClick={() => history.back()}>
        {i18n.t('Go Back')}
      </button>
    </div>
  )
}
