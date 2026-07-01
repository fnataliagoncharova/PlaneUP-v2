import { AlertCircle, KeyRound, Plus, RefreshCw, ShieldCheck, UserCog } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "../auth/AuthContext";
import { useRole } from "../auth/useRole";
import V2ConfirmDialog from "../components/common/V2ConfirmDialog";
import {
  createUser,
  getUsers,
  updateUser,
  updateUserActive,
  updateUserPassword,
} from "../services/usersApi";


const ROLE_OPTIONS = [
  { value: "admin", label: "Администратор" },
  { value: "planner", label: "Планировщик" },
  { value: "master", label: "Мастер" },
  { value: "maintenance", label: "Ответственный за ТО" },
  { value: "viewer", label: "Просмотр" },
];


function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleString("ru-RU");
}


function toUsersAdminErrorMessage(error, fallbackText) {
  if (error?.status === 403 || error?.message === "Forbidden") {
    return "Недостаточно прав для управления пользователями.";
  }

  return error?.message || fallbackText;
}


function buildInitialCreateForm() {
  return {
    username: "",
    full_name: "",
    password: "",
    role: "",
    is_active: false,
  };
}


function buildRowDrafts(items) {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        username: item.username || "",
        full_name: item.full_name || "",
        role: item.role || "",
      },
    ]),
  );
}


function UsersSection() {
  const { logout } = useAuth();
  const { user } = useRole();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pageError, setPageError] = useState("");
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [showInactiveUsers, setShowInactiveUsers] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState(buildInitialCreateForm());
  const [rowDrafts, setRowDrafts] = useState({});
  const [savingUserId, setSavingUserId] = useState(null);
  const [savedUserId, setSavedUserId] = useState(null);
  const [passwordDialogUser, setPasswordDialogUser] = useState(null);
  const [passwordValue, setPasswordValue] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [activeChangeCandidate, setActiveChangeCandidate] = useState(null);
  const [isUpdatingActive, setIsUpdatingActive] = useState(false);

  const canManageUsers = user?.role === "admin";

  const sortedUsers = useMemo(
    () => [...users].sort((left, right) => String(left.username || "").localeCompare(String(right.username || ""), "ru")),
    [users],
  );

  const filteredUsers = useMemo(
    () => sortedUsers.filter((item) => showInactiveUsers || item.is_active),
    [showInactiveUsers, sortedUsers],
  );

  const loadUsers = useCallback(async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setPageError("");

    try {
      const items = await getUsers();
      const normalizedUsers = Array.isArray(items) ? items : [];
      setUsers(normalizedUsers);
      setRowDrafts(buildRowDrafts(normalizedUsers));
    } catch (error) {
      setPageError(toUsersAdminErrorMessage(error, "Не удалось загрузить список пользователей."));
      setUsers([]);
      setRowDrafts({});
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (!canManageUsers) {
      return;
    }

    loadUsers();
  }, [canManageUsers, loadUsers]);

  const handleCreateFieldChange = (field, value) => {
    setCreateForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCreateUser = async (event) => {
    event.preventDefault();
    if (!canManageUsers) {
      setCreateError("Недостаточно прав для управления пользователями.");
      return;
    }

    setIsCreating(true);
    setCreateError("");
    setCreateSuccess("");
    setPageError("");

    try {
      await createUser({
        username: createForm.username.trim(),
        full_name: createForm.full_name.trim() || null,
        password: createForm.password,
        role: createForm.role,
        is_active: createForm.is_active,
      });
      setCreateForm(buildInitialCreateForm());
      setCreateSuccess("Пользователь создан.");
      await loadUsers({ silent: true });
    } catch (error) {
      setCreateError(toUsersAdminErrorMessage(error, "Не удалось создать пользователя."));
    } finally {
      setIsCreating(false);
    }
  };

  const handleRowDraftChange = (userId, field, value) => {
    setRowDrafts((prev) => ({
      ...prev,
      [userId]: {
        username: prev[userId]?.username ?? "",
        full_name: prev[userId]?.full_name ?? "",
        role: prev[userId]?.role ?? "",
        [field]: value,
      },
    }));
  };

  const handleSaveUser = async (targetUser) => {
    if (!canManageUsers) {
      setPageError("Недостаточно прав для управления пользователями.");
      return;
    }

    const draft = rowDrafts[targetUser.id];
    if (!draft) {
      return;
    }

    const nextUsername = draft.username.trim();
    const nextFullName = draft.full_name.trim();
    const nextRole = draft.role;
    const currentFullName = targetUser.full_name || "";
    const isDirty =
      nextUsername !== (targetUser.username || "") ||
      nextFullName !== currentFullName ||
      nextRole !== targetUser.role;

    if (!isDirty || !nextUsername) {
      return;
    }

    setSavingUserId(targetUser.id);
    setPageError("");

    try {
      const updatedUser = await updateUser(targetUser.id, {
        username: nextUsername,
        full_name: nextFullName || null,
        role: nextRole,
      });
      setUsers((prev) => prev.map((item) => (item.id === targetUser.id ? updatedUser : item)));
      setRowDrafts((prev) => ({
        ...prev,
        [targetUser.id]: {
          username: updatedUser.username || "",
          full_name: updatedUser.full_name || "",
          role: updatedUser.role || "",
        },
      }));
      setSavedUserId(targetUser.id);
      setSavingUserId(null);
      window.setTimeout(() => {
        setSavedUserId((currentUserId) => (currentUserId === targetUser.id ? null : currentUserId));
      }, 1000);

      if (user?.id === targetUser.id && nextUsername !== targetUser.username) {
        window.alert("Логин текущего пользователя изменён. Войдите в систему заново.");
        logout();
      }
    } catch (error) {
      setPageError(toUsersAdminErrorMessage(error, "Не удалось сохранить пользователя."));
    } finally {
      setSavingUserId((currentUserId) => (currentUserId === targetUser.id ? null : currentUserId));
    }
  };

  const openPasswordDialog = (targetUser) => {
    if (!canManageUsers) {
      setPageError("Недостаточно прав для управления пользователями.");
      return;
    }

    setPasswordDialogUser(targetUser);
    setPasswordValue("");
    setPasswordError("");
  };

  const closePasswordDialog = () => {
    if (isUpdatingPassword) {
      return;
    }

    setPasswordDialogUser(null);
    setPasswordValue("");
    setPasswordError("");
  };

  const handleUpdatePassword = async () => {
    if (!passwordDialogUser) {
      return;
    }

    if (!canManageUsers) {
      setPasswordError("Недостаточно прав для управления пользователями.");
      return;
    }

    if (!passwordValue.trim()) {
      setPasswordError("Введите новый пароль.");
      return;
    }

    setIsUpdatingPassword(true);
    setPasswordError("");
    setPageError("");

    try {
      await updateUserPassword(passwordDialogUser.id, passwordValue);
      closePasswordDialog();
    } catch (error) {
      setPasswordError(toUsersAdminErrorMessage(error, "Не удалось изменить пароль пользователя."));
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleConfirmActiveChange = async () => {
    if (!activeChangeCandidate) {
      return;
    }

    if (!canManageUsers) {
      setPageError("Недостаточно прав для управления пользователями.");
      setActiveChangeCandidate(null);
      return;
    }

    setIsUpdatingActive(true);
    setPageError("");

    try {
      await updateUserActive(activeChangeCandidate.id, activeChangeCandidate.nextIsActive);
      await loadUsers({ silent: true });
      setActiveChangeCandidate(null);
    } catch (error) {
      setPageError(toUsersAdminErrorMessage(error, "Не удалось изменить активность пользователя."));
    } finally {
      setIsUpdatingActive(false);
    }
  };

  if (!canManageUsers) {
    return (
      <section className="glass-panel p-5 text-sm text-rose-100">
        Недостаточно прав для управления пользователями.
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <header className="glass-panel p-4 sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <h1 className="font-['Space_Grotesk'] text-3xl font-semibold text-slate-50 sm:text-4xl">
              Пользователи
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Управление учетными записями, ролями и доступностью входа в систему.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadUsers({ silent: true })}
            disabled={isLoading || isRefreshing}
            className="inline-flex items-center gap-2 rounded-none border border-white/12 px-4 py-2.5 text-sm text-slate-200 transition hover:border-cyan-300/30 disabled:opacity-60"
          >
            <RefreshCw className={["h-4 w-4", isRefreshing ? "animate-spin" : ""].join(" ")} />
            Обновить
          </button>
        </div>

        {pageError ? (
          <div className="mt-4 flex items-start gap-3 border border-rose-300/30 bg-rose-500/[0.1] px-4 py-3 text-sm text-rose-100">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{pageError}</span>
          </div>
        ) : null}

      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <section className="glass-panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
            <div>
              <div className="text-lg font-semibold text-slate-50">Список пользователей</div>
              <div className="mt-1 text-xs tracking-[0.08em] text-slate-500">
                Записей: {filteredUsers.length}
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={showInactiveUsers}
                onChange={(event) => setShowInactiveUsers(event.target.checked)}
                className="h-4 w-4 rounded-none border-white/20 bg-transparent"
              />
              Показывать неактивных
            </label>
          </div>

          {isLoading ? (
            <div className="px-5 py-5 text-sm text-slate-400">Загружаем пользователей...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-5 py-5 text-sm text-slate-400">
              {showInactiveUsers ? "Пользователи пока не найдены." : "Активные пользователи не найдены."}
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-[linear-gradient(180deg,rgba(19,39,56,0.95),rgba(14,28,40,0.96))] text-xs uppercase tracking-[0.08em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">ID</th>
                    <th className="px-3 py-2 text-left font-medium">Логин</th>
                    <th className="px-3 py-2 text-left font-medium">ФИО</th>
                    <th className="px-3 py-2 text-left font-medium">Роль</th>
                    <th className="px-3 py-2 text-left font-medium">Активен</th>
                    <th className="px-3 py-2 text-left font-medium">Создан</th>
                    <th className="px-3 py-2 text-left font-medium">Изменен</th>
                    <th className="px-3 py-2 text-right font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((item) => {
                    const draft = rowDrafts[item.id] || {
                      username: item.username || "",
                      full_name: item.full_name || "",
                      role: item.role || "",
                    };
                    const nextUsername = draft.username.trim();
                    const nextFullName = draft.full_name.trim();
                    const nextRole = draft.role;
                    const currentFullName = item.full_name || "";
                    const isDirty =
                      nextUsername !== (item.username || "") ||
                      nextFullName !== currentFullName ||
                      nextRole !== item.role;
                    const isSaving = savingUserId === item.id;
                    const isSaved = savedUserId === item.id;

                    return (
                      <tr
                        key={item.id}
                        className={[
                          "border-t border-white/[0.05] hover:bg-cyan-300/[0.03]",
                          item.is_active ? "" : "bg-slate-950/20",
                        ].join(" ")}
                      >
                        <td className="px-3 py-2.5 tabular-nums text-slate-200">{item.id}</td>
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={draft.username}
                            onChange={(event) => handleRowDraftChange(item.id, "username", event.target.value)}
                            className="h-9 w-full min-w-[160px] rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-2 text-sm font-medium text-slate-100 outline-none focus:border-cyan-300/40"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <input
                            type="text"
                            value={draft.full_name}
                            onChange={(event) => handleRowDraftChange(item.id, "full_name", event.target.value)}
                            placeholder="—"
                            className="h-9 w-full min-w-[200px] rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-2 text-sm text-slate-300 outline-none focus:border-cyan-300/40"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <select
                            value={draft.role}
                            onChange={(event) => handleRowDraftChange(item.id, "role", event.target.value)}
                            className="h-9 min-w-[180px] rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-2 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
                          >
                            {ROLE_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={[
                              "inline-flex rounded-none border px-2 py-0.5 text-xs",
                              item.is_active
                                ? "border-emerald-300/25 bg-emerald-400/[0.08] text-emerald-100"
                                : "border-amber-300/25 bg-amber-400/[0.08] text-amber-100",
                            ].join(" ")}
                          >
                            {item.is_active ? "Да" : "Нет"}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-400">{formatDateTime(item.created_at)}</td>
                        <td className="px-3 py-2.5 text-slate-400">{formatDateTime(item.updated_at)}</td>
                        <td className="px-3 py-2.5">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleSaveUser(item)}
                              disabled={!isDirty || !nextUsername || isSaving}
                              className={[
                                "inline-flex h-8 items-center rounded-none border px-3 text-xs font-medium transition disabled:opacity-50",
                                isSaved && !isDirty
                                  ? "border-emerald-300/30 bg-emerald-400/[0.10] text-emerald-100"
                                  : "border-cyan-300/30 bg-cyan-400/[0.12] text-cyan-50 hover:bg-cyan-400/[0.18]",
                              ].join(" ")}
                            >
                              {isSaving ? "..." : isSaved && !isDirty ? "✓" : "Сохранить"}
                            </button>
                            <button
                              type="button"
                              onClick={() => openPasswordDialog(item)}
                              className="inline-flex h-8 items-center gap-1 rounded-none border border-white/12 px-2 text-xs text-slate-200 transition hover:border-cyan-300/30"
                            >
                              <KeyRound className="h-3.5 w-3.5" />
                              Пароль
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setActiveChangeCandidate({
                                  id: item.id,
                                  username: item.username,
                                  nextIsActive: !item.is_active,
                                })
                              }
                              className={[
                                "inline-flex h-8 items-center rounded-none border px-2 text-xs transition",
                                item.is_active
                                  ? "border-amber-300/28 bg-amber-400/[0.08] text-amber-100 hover:bg-amber-400/[0.14]"
                                  : "border-emerald-300/28 bg-emerald-400/[0.08] text-emerald-100 hover:bg-emerald-400/[0.14]",
                              ].join(" ")}
                            >
                              {item.is_active ? "Деактивировать" : "Активировать"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <aside className="glass-panel h-fit p-5 sm:p-6 xl:sticky xl:top-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-none border border-cyan-300/22 bg-cyan-400/[0.08] text-cyan-100">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs tracking-[0.08em] text-slate-500">Администрирование</div>
              <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-50">Создать пользователя</h2>
            </div>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleCreateUser} autoComplete="off">
            <div>
              <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Логин</div>
              <input
                type="text"
                name="create_user_username"
                autoComplete="off"
                value={createForm.username}
                onChange={(event) => handleCreateFieldChange("username", event.target.value)}
                className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
              />
            </div>
            <div>
              <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">ФИО</div>
              <input
                type="text"
                name="create_user_full_name"
                autoComplete="off"
                value={createForm.full_name}
                onChange={(event) => handleCreateFieldChange("full_name", event.target.value)}
                className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
              />
            </div>
            <div>
              <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Пароль</div>
              <input
                type="password"
                name="create_user_password"
                autoComplete="new-password"
                value={createForm.password}
                onChange={(event) => handleCreateFieldChange("password", event.target.value)}
                className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
              />
            </div>
            <div>
              <div className="mb-2 text-xs tracking-[0.08em] text-slate-500">Роль</div>
              <select
                value={createForm.role}
                onChange={(event) => handleCreateFieldChange("role", event.target.value)}
                className="h-11 w-full rounded-none border border-white/[0.08] bg-[rgba(8,22,34,0.75)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
              >
                <option value="">Выберите роль</option>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={createForm.is_active}
                onChange={(event) => handleCreateFieldChange("is_active", event.target.checked)}
                className="h-4 w-4 rounded-none border-white/20 bg-transparent"
              />
              Активный пользователь
            </label>

            {createError ? <div className="text-sm text-rose-200">{createError}</div> : null}
            {createSuccess ? <div className="text-sm text-emerald-200">{createSuccess}</div> : null}

            <button
              type="submit"
              disabled={isCreating || !createForm.username.trim() || !createForm.password.trim() || !createForm.role}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-none border border-cyan-300/35 bg-cyan-400/[0.15] px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.22] disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {isCreating ? "Создаем..." : "Создать пользователя"}
            </button>
          </form>

          <div className="mt-6 border-t border-white/[0.08] pt-5">
            <div className="flex items-start gap-3 text-sm text-slate-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
              <div className="space-y-1 text-slate-400">
                <div>Роли назначаются из фиксированного списка системы.</div>
                <div>Пароль хранится только на backend в виде hash.</div>
                <div>Последнего активного администратора отключить нельзя.</div>
              </div>
            </div>
          </div>
        </aside>
      </div>

      {passwordDialogUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-md rounded-none border border-cyan-300/20 bg-[rgba(10,24,36,0.98)] p-5 shadow-[0_22px_80px_rgba(6,10,14,0.65)]">
            <div className="text-lg font-semibold text-slate-50">
              Новый пароль для {passwordDialogUser.username}
            </div>
            <input
              type="password"
              value={passwordValue}
              onChange={(event) => setPasswordValue(event.target.value)}
              className="mt-4 h-11 w-full rounded-none border border-white/[0.12] bg-[rgba(8,22,34,0.82)] px-3 text-sm text-slate-100 outline-none focus:border-cyan-300/40"
            />
            {passwordError ? <div className="mt-3 text-sm text-rose-200">{passwordError}</div> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={closePasswordDialog}
                disabled={isUpdatingPassword}
                className="h-9 rounded-none border border-white/15 px-4 text-sm text-slate-200 transition hover:border-cyan-300/30 disabled:opacity-60"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleUpdatePassword}
                disabled={isUpdatingPassword}
                className="h-9 rounded-none border border-cyan-300/35 bg-cyan-400/[0.14] px-4 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-400/[0.24] disabled:opacity-60"
              >
                {isUpdatingPassword ? "Сохраняем..." : "Сохранить пароль"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <V2ConfirmDialog
        open={Boolean(activeChangeCandidate)}
        title={activeChangeCandidate?.nextIsActive ? "Активировать пользователя?" : "Деактивировать пользователя?"}
        message={
          activeChangeCandidate
            ? `${activeChangeCandidate.nextIsActive ? "Пользователь будет снова допущен к входу" : "Пользователь потеряет возможность входа"}: ${activeChangeCandidate.username}.`
            : ""
        }
        confirmText={
          isUpdatingActive
            ? "Сохраняем..."
            : activeChangeCandidate?.nextIsActive
              ? "Активировать"
              : "Деактивировать"
        }
        cancelText="Отмена"
        onConfirm={handleConfirmActiveChange}
        onCancel={() => setActiveChangeCandidate(null)}
        isConfirmDisabled={isUpdatingActive}
        isCancelDisabled={isUpdatingActive}
      />
    </section>
  );
}


export default UsersSection;
