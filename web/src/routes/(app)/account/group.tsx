import { IconInfoCircle, IconUsersGroup } from '@tabler/icons-solidjs'
import { createFileRoute } from '@tanstack/solid-router'
import { For, Show } from 'solid-js'
import { partnerV1MemberInfos } from '@/api'
import { NoContent } from '@/shared/NoContent'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'

export const Route = createFileRoute('/(app)/account/group')({
  component: RouteComponent,
})

function RouteComponent() {
  const { t } = useTranslation()

  const [members] = createCachedStore(
    'partnerV1MemberInfos',
    () => ({}),
    async () => {
      const { data } = await partnerV1MemberInfos()
      return data
    },
  )

  return (
    <div class="m-auto max-w-lg space-y-8">
      <Show
        when={members.data?.length}
        fallback={<NoContent icon={IconUsersGroup} message={t('No groups have been registered yet.')} />}
      >
        <For each={members.data}>
          {(info) => (
            <div class="card bg-base-100 shadow">
              <div class="card-body">
                <div class="flex gap-4">
                  <img
                    src={info.group.partner.logo}
                    alt={info.group.partner.name}
                    class="h-24 w-24 rounded aspect-square"
                  />
                  <div class="space-y-1">
                    <div class="text-xs label flex items-center gap-2">
                      {info.group.partner.name}
                      <a href={info.group.partner.website} target="_blank" class="link link-info">
                        {info.group.partner.website}
                      </a>
                    </div>
                    <div class="text-lg font-semibold flex items-center gap-4">
                      {info.group.name}
                      <span class="badge badge-soft badge-accent badge-sm">
                        {t('Group member {{count}}', { count: info.memberCount })}
                      </span>
                    </div>
                    <div class="text-sm label" title={info.group.description}>
                      {info.group.description}
                    </div>
                  </div>
                </div>

                <div class="dropdown mt-2 self-end dropdown-end">
                  <div tabindex="0" class="btn btn-sm btn-primary">
                    {t('View my member profile')}
                  </div>
                  <div tabindex="-1" class="dropdown-content bg-base-100 rounded-box z-1 p-4 shadow-xl w-100 space-y-4">
                    <div class="label gap-2 text-sm/snug">
                      <IconInfoCircle class="shrink-0" />
                      {t(
                        'This profile is registered with a group and is managed by the group staff. ' +
                          'If you need to make changes, please contact the group staff.',
                      )}
                    </div>

                    <div class="overflow-x-auto rounded-box border border-base-content/5 bg-base-100">
                      <table class="table table-sm">
                        <tbody>
                          <tr>
                            <th>{t('Name')}</th>
                            <td>{info.name}</td>
                          </tr>
                          <tr>
                            <th>{t('Email')}</th>
                            <td>{info.email}</td>
                          </tr>
                          <tr>
                            <th>{t('Phone')}</th>
                            <td>{info.phone}</td>
                          </tr>
                          <tr>
                            <th>{t('Team')}</th>
                            <td>{info.team}</td>
                          </tr>
                          <tr>
                            <th>{t('Job Position')}</th>
                            <td>{info.jobPosition}</td>
                          </tr>
                          <tr>
                            <th>{t('Job Title')}</th>
                            <td>{info.jobTitle}</td>
                          </tr>
                          <Show when={info.employmentStatus}>
                            <tr>
                              <th>{t('Employment Status')}</th>
                              <td>{info.employmentStatus}</td>
                            </tr>
                          </Show>
                          <Show when={info.employmentType}>
                            <tr>
                              <th>{t('Employment Type')}</th>
                              <td>{info.employmentType}</td>
                            </tr>
                          </Show>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div class="divider divider-start after:h-px text-base-content/60">{t('Linked Cohorts')}</div>

                <div class="space-y-8">
                  <For each={info.cohorts}>
                    {(cohort) => (
                      <div class="flex gap-4">
                        <div class="flex flex-col gap-1">
                          <div class="text-lg font-semibold flex items-center gap-4">
                            {cohort.name}
                            <div class="badge badge-soft badge-accent badge-sm">
                              {t('Cohort member {{count}}', { count: cohort.memberCount })}
                            </div>
                          </div>
                          <div class="label text-sm">{cohort.description}</div>

                          <div class="space-y-6 mt-4 px-4">
                            <div class="label mb-2 text-xs">{t('Staffs')}</div>
                            <For each={cohort.staffs}>
                              {(staff) => (
                                <div class="flex items-center gap-2">
                                  <div class="avatar avatar-placeholder capitalize">
                                    <div class="rounded-full bg-base-content/10 w-8">
                                      <Show when={staff.staff.avatar} fallback={<span>{staff.staff.name[0]}</span>}>
                                        <img src={staff.staff.avatar!} alt={staff.staff.name} />
                                      </Show>
                                    </div>
                                  </div>
                                  <div class="flex flex-col gap-0">
                                    <div class="text-sm flex items-center gap-2">
                                      {staff.staff.name}
                                      <div class="badge badge-xs badge-soft">{t(staff.role)}</div>
                                    </div>
                                    <div class="label text-xs">{staff.staff.email}</div>
                                  </div>
                                </div>
                              )}
                            </For>
                          </div>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </div>
          )}
        </For>
      </Show>
    </div>
  )
}
