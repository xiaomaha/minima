import { useTransContext } from '@mbarzda/solid-i18next'
import { IconHandStop } from '@tabler/icons-solidjs'
import { createMemo, createSignal, For, Show } from 'solid-js'
import type { AppealSchema } from '@/api'
import { Dialog } from '@/shared/Diaglog'
import { Appeal } from '../../-shared/grading/Appeal'
import { ScorePanel } from '../../-shared/grading/ScorePanel'
import { useSession } from './context'

interface RubricTableData {
  criterionName: string
  points: number
  levelName: string
  rowSpan: number
  showCriterion: boolean
  earned: number | undefined | null
  feedback: string | undefined
}

export const GradingReview = () => {
  const [t] = useTransContext()

  const [session, { setStore }] = useSession()
  const s = () => session.data!

  const assignment = s().assignment
  const grade = s().grade!
  const solution = s().attempt!.question.solution
  const rubricData = solution.rubricData

  const possiblePoint = grade.possiblePoint
  const passingScore = assignment.passingPoint ?? 0

  const rubricTableData: () => Array<RubricTableData> = createMemo(() =>
    rubricData.criteria.flatMap((criterion) =>
      criterion.performanceLevels.map((level, levelIdx) => ({
        showCriterion: levelIdx === 0,
        rowSpan: criterion.performanceLevels.length,
        criterionName: criterion.name,
        points: level.point,
        levelName: level.name,
        earned: grade.earnedDetails[criterion.name],
        feedback: grade.feedback[criterion.name],
      })),
    ),
  )

  const onCreateAppeal = (appeal: AppealSchema) => {
    setStore('data', 'appeal', appeal)
  }

  const [appealDialogOpen, setAppealDialogOpen] = createSignal(false)
  const question = s().attempt!.question
  const appeal = () => s().appeal

  return (
    <>
      <div class="w-full space-y-12">
        <ScorePanel grade={grade} passingScore={passingScore} />

        <Show when={solution.explanation}>
          <div class="label my-1 text-sm">{t('Explanation')}</div>
          <div>{solution.explanation}</div>
        </Show>

        <Show
          when={
            appeal() ||
            (!grade.confirmed && new Date(s().gradingDate.confirmDue) > new Date() && grade.earnedPoint < possiblePoint)
          }
        >
          <div class="text-right">
            <button type="button" class="btn btn-sm btn-neutral" onClick={() => setAppealDialogOpen(true)}>
              <IconHandStop size={20} />
              {!appeal() ? t('Appeal available') : appeal()?.closed ? t('Appeal reviewed') : t('Appeal pending')}
            </button>
          </div>
        </Show>

        <div class="label my-1 text-sm">{t('Assessment')}</div>
        <div class="overflow-x-auto">
          <table class="table rounded-box border border-base-content/5 bg-base-100 border-collapse">
            <thead>
              <tr>
                <th class="text-center">{t('Criterion')}</th>
                <th class="text-center">{t('Level')}</th>
                <th class="text-center">{t('Points')}</th>
                <th class="text-center">{t('Earned')}</th>
              </tr>
            </thead>
            <tbody>
              <For each={rubricTableData()}>
                {(row) => (
                  <tr>
                    <Show when={row.showCriterion}>
                      <td rowspan={row.rowSpan}>
                        {row.criterionName}
                        <Show when={row.feedback}>
                          <div class="mt-2 alert alert-soft alert-info">{row.feedback}</div>
                        </Show>
                      </td>
                    </Show>
                    <td>{row.levelName}</td>
                    <td>
                      <span class="flex items-center gap-6">
                        {row.points}
                        <input
                          type="radio"
                          class="radio radio-primary pointer-events-none"
                          checked={row.earned === row.points}
                          name={row.criterionName}
                        />
                      </span>
                    </td>
                    <Show when={row.showCriterion}>
                      <td rowspan={row.rowSpan} class="text-center font-bold">
                        <Show when={row.earned}>{row.earned}</Show>
                      </td>
                    </Show>
                  </tr>
                )}
              </For>
            </tbody>
          </table>
        </div>
      </div>

      <Dialog
        title={t('Assignment Grading Appeal')}
        boxClass="max-w-3xl"
        open={!!appealDialogOpen()}
        onClose={() => setAppealDialogOpen(false)}
      >
        <Appeal
          appeal={appeal()}
          appLabel="assignment"
          model="question"
          questionId={question.id}
          onCreate={onCreateAppeal}
        />
      </Dialog>
    </>
  )
}
