const API_URL = "/api/tasks";

const addTaskBtn = document.getElementById("addTaskBtn");
const taskForm = document.getElementById("taskForm");
const cancelBtn = document.getElementById("cancelBtn");
const taskList = document.getElementById("taskList");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const priorityFilter = document.getElementById("priorityFilter");
const message = document.getElementById("message");

let tasks = [];
let editingTaskId = null;

addTaskBtn.addEventListener("click", () => {
    editingTaskId = null;
    taskForm.reset();
    document.getElementById("formHeading").textContent = "Create a Task";
    taskForm.classList.remove("hidden");
    document.getElementById("title").focus();
});

cancelBtn.addEventListener("click", () => {
    taskForm.classList.add("hidden");
    editingTaskId = null;
});

async function loadTasks() {
    try {
        const response = await fetch(API_URL);

        if (!response.ok) {
            throw new Error("Could not load tasks.");
        }

        tasks = await response.json();
        renderTasks();
        message.textContent = "";
    } catch (error) {
        message.textContent =
            "Cannot connect to the backend. Please check that your Python server is running.";
        console.error(error);
    }
}

function renderTasks() {
    const search = searchInput.value.toLowerCase().trim();
    const selectedStatus = statusFilter.value;
    const selectedPriority = priorityFilter.value;

    const filteredTasks = tasks.filter(task => {
        const matchesSearch =
            task.title.toLowerCase().includes(search) ||
            (task.description || "").toLowerCase().includes(search);

        const matchesStatus =
            !selectedStatus || task.status === selectedStatus;

        const matchesPriority =
            !selectedPriority || task.priority === selectedPriority;

        return matchesSearch && matchesStatus && matchesPriority;
    });

    taskList.replaceChildren();

    document.getElementById("totalCount").textContent = tasks.length;
    document.getElementById("pendingCount").textContent =
        tasks.filter(task => task.status === "Pending").length;
    document.getElementById("completedCount").textContent =
        tasks.filter(task => task.status === "Completed").length;

    if (filteredTasks.length === 0) {
        const emptyMessage = document.createElement("p");
        emptyMessage.textContent = tasks.length
            ? "No tasks match your filters."
            : "No tasks yet. Click + Create New Task to get started.";
        taskList.appendChild(emptyMessage);
        return;
    }

    filteredTasks.forEach(task => {
        const card = document.createElement("article");
        card.className = "task-card";

        const title = document.createElement("h3");
        title.textContent = task.title;

        const description = document.createElement("p");
        description.textContent = task.description || "No description";

        const details = document.createElement("p");
        details.textContent =
            `Priority: ${task.priority} | Status: ${task.status}` +
            (task.due_date ? ` | Due: ${task.due_date}` : "");

        const statusSelect = document.createElement("select");

        ["Pending", "In Progress", "Completed"].forEach(status => {
            const option = document.createElement("option");
            option.value = status;
            option.textContent = status;
            option.selected = task.status === status;
            statusSelect.appendChild(option);
        });

        statusSelect.setAttribute("aria-label", "Change task status");

        statusSelect.addEventListener("change", async () => {
            try {
                const response = await fetch(`${API_URL}/${task.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ status: statusSelect.value })
                });

                if (!response.ok) throw new Error("Status update failed.");

                await loadTasks();
            } catch (error) {
                alert(error.message);
            }
        });

        const editBtn = document.createElement("button");
        editBtn.type = "button";
        editBtn.textContent = "Edit";
        editBtn.className = "secondary-btn";

        editBtn.addEventListener("click", () => {
            editingTaskId = task.id;

            document.getElementById("formHeading").textContent = "Edit Task";
            document.getElementById("title").value = task.title;
            document.getElementById("description").value = task.description || "";
            document.getElementById("priority").value = task.priority;
            document.getElementById("status").value = task.status;
            document.getElementById("dueDate").value = task.due_date || "";

            taskForm.classList.remove("hidden");
            document.getElementById("title").focus();
        });

        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.textContent = "Delete";
        deleteBtn.className = "secondary-btn";

        deleteBtn.addEventListener("click", async () => {
            if (!confirm(`Delete "${task.title}"?`)) return;

            try {
                const response = await fetch(`${API_URL}/${task.id}`, {
                    method: "DELETE"
                });

                if (!response.ok) throw new Error("Could not delete task.");

                await loadTasks();
            } catch (error) {
                alert(error.message);
            }
        });

        card.append(title, description, details, statusSelect, editBtn, deleteBtn);
        taskList.appendChild(card);
    });
}

taskForm.addEventListener("submit", async event => {
    event.preventDefault();

    const task = {
        title: document.getElementById("title").value.trim(),
        description: document.getElementById("description").value.trim(),
        priority: document.getElementById("priority").value,
        status: document.getElementById("status").value,
        due_date: document.getElementById("dueDate").value || null
    };

    if (!task.title) {
        alert("Please enter a task title.");
        return;
    }

    try {
        const response = await fetch(
            editingTaskId ? `${API_URL}/${editingTaskId}` : API_URL,
            {
                method: editingTaskId ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(task)
            }
        );

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Could not save task.");
        }

        taskForm.classList.add("hidden");
        taskForm.reset();
        editingTaskId = null;
        message.textContent = "Task saved successfully!";

        await loadTasks();
    } catch (error) {
        message.textContent = error.message;
        console.error(error);
    }
});

searchInput.addEventListener("input", renderTasks);
statusFilter.addEventListener("change", renderTasks);
priorityFilter.addEventListener("change", renderTasks);

document.getElementById("pendingLink").addEventListener("click", event => {
    event.preventDefault();
    statusFilter.value = "Pending";
    renderTasks();
});

document.getElementById("completedLink").addEventListener("click", event => {
    event.preventDefault();
    statusFilter.value = "Completed";
    renderTasks();
});

document.querySelector(".sidebar nav a").addEventListener("click", event => {
    event.preventDefault();
    statusFilter.value = "";
    priorityFilter.value = "";
    searchInput.value = "";
    renderTasks();
});

loadTasks();

