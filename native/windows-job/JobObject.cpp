#include "JobObject.h"
#include <sstream>
JobObject::JobObject() : handle_(CreateJobObjectA(nullptr, nullptr)) {}
JobObject::~JobObject() { if (handle_ != nullptr) { CloseHandle(handle_); handle_ = nullptr; } }
bool JobObject::configure(const JobLimits& limits, std::string& error) {
    if (!handle_) { error=lastError("CreateJobObject"); return false; }
    if (!limits.memoryBytes || limits.memoryBytes > static_cast<std::uint64_t>(SIZE_MAX)) { error="memoryBytes must be greater than zero and fit in SIZE_T"; return false; }
    if (!limits.activeProcessLimit) { error="activeProcessLimit must be greater than zero"; return false; }
    if (!limits.cpuTimeLimitMs) { error="cpuTimeLimitMs must be greater than zero"; return false; }
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION extended{};
    extended.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | JOB_OBJECT_LIMIT_ACTIVE_PROCESS | JOB_OBJECT_LIMIT_PROCESS_TIME | JOB_OBJECT_LIMIT_JOB_MEMORY;
    extended.BasicLimitInformation.ActiveProcessLimit = limits.activeProcessLimit;
    extended.BasicLimitInformation.PerProcessUserTimeLimit.QuadPart = static_cast<LONGLONG>(limits.cpuTimeLimitMs) * 10000;
    extended.JobMemoryLimit = static_cast<SIZE_T>(limits.memoryBytes);
    if (!SetInformationJobObject(handle_, JobObjectExtendedLimitInformation, &extended, sizeof(extended))) { error=lastError("SetInformationJobObject"); return false; }
    return true;
}
bool JobObject::assignProcess(HANDLE process, std::string& error) {
    if (!handle_) { error=lastError("JobObject handle"); return false; }
    if (!process) { error="process handle is null"; return false; }
    if (!AssignProcessToJobObject(handle_, process)) { error=lastError("AssignProcessToJobObject"); return false; }
    return true;
}
bool JobObject::terminate(std::uint32_t exitCode, std::string& error) {
    if (!handle_) { error=lastError("JobObject handle"); return false; }
    if (!TerminateJobObject(handle_, static_cast<UINT>(exitCode))) { error=lastError("TerminateJobObject"); return false; }
    return true;
}
std::string JobObject::lastError(const char* operation) {
    const DWORD code=GetLastError(); std::ostringstream output; output << operation << " failed with Windows error " << code; return output.str();
}